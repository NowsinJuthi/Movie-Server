import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { Model, Types } from 'mongoose';
import {
  MATURITY_RANK,
  MaturityLevel,
  RecommendationReason,
  RecommendationStrategy,
  type RecommendationItem,
} from '@movie-server/shared';
import { ProfileAccessService } from './profile-access.service';
import { Recommendation, RecommendationDocument } from './schemas/recommendation.schema';
import { WatchHistory } from './schemas/watch-history.schema';
import { MyListItem } from './schemas/my-list.schema';
import { Favorite } from './schemas/favorite.schema';
import { MediaReactionDoc } from './schemas/media-reaction.schema';
import { UserRating } from './schemas/user-rating.schema';
import { Movie, MovieDocument } from '../movies/schemas/movie.schema';
import { Series, SeriesDocument } from '../series/schemas/series.schema';
import { RedisService } from '../redis/redis.service';
import { RECOMMENDATION_QUEUE, recommendationsCacheKey, invalidateHomeProfileCache } from '../common/cache-keys';
import {
  rankRecommendations,
  seedWeight,
  topGenres,
  genreAffinity,
  type CatalogCandidate,
  type RecommendationSignals,
  type TasteSeed,
} from './recommendation-engine';

const CATALOG_LIMIT = 80;
const RESULT_LIMIT = 20;
const REC_CACHE_MS = 60_000;

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(
    @InjectModel(Recommendation.name)
    private readonly recommendationModel: Model<RecommendationDocument>,
    @InjectModel(WatchHistory.name) private readonly historyModel: Model<WatchHistory>,
    @InjectModel(MyListItem.name) private readonly listModel: Model<MyListItem>,
    @InjectModel(Favorite.name) private readonly favoriteModel: Model<Favorite>,
    @InjectModel(MediaReactionDoc.name) private readonly reactionModel: Model<MediaReactionDoc>,
    @InjectModel(UserRating.name) private readonly ratingModel: Model<UserRating>,
    @InjectModel(Movie.name) private readonly movieModel: Model<MovieDocument>,
    @InjectModel(Series.name) private readonly seriesModel: Model<SeriesDocument>,
    private readonly access: ProfileAccessService,
    private readonly redis: RedisService,
    @Optional() @InjectQueue(RECOMMENDATION_QUEUE) private readonly queue?: Queue,
  ) {}

  async list(userId: string, profileId: string): Promise<RecommendationItem[]> {
    await this.access.getOwned(userId, profileId);
    const cached = await this.redis.client.get(recommendationsCacheKey(profileId));
    if (cached) {
      return JSON.parse(cached) as RecommendationItem[];
    }
    const stored = await this.recommendationModel
      .find({ profileId: new Types.ObjectId(profileId), userId: new Types.ObjectId(userId) })
      .sort({ score: -1 })
      .limit(RESULT_LIMIT)
      .exec();
    if (stored.length) {
      const items = stored.map(toPublic);
      await this.redis.client.set(recommendationsCacheKey(profileId), JSON.stringify(items), 'PX', REC_CACHE_MS);
      return items;
    }
    return this.refresh(userId, profileId);
  }

  async scheduleRefresh(userId: string, profileId: string): Promise<void> {
    await this.redis.client.del(recommendationsCacheKey(profileId));
    await invalidateHomeProfileCache(this.redis.client, profileId);
    if (this.queue) {
      try {
        await this.queue.add(
          'refresh',
          { userId, profileId },
          { jobId: `rec-${profileId}`, delay: 250, removeOnComplete: 20, removeOnFail: 50 },
        );
      } catch (error) {
        this.logger.warn(
          `Recommendation queue add failed, refreshing inline: ${error instanceof Error ? error.message : 'error'}`,
        );
        await this.refresh(userId, profileId);
      }
      return;
    }
    await this.refresh(userId, profileId);
  }

  async refresh(userId: string, profileId: string): Promise<RecommendationItem[]> {
    const profile = await this.access.getOwned(userId, profileId);
    const profileOid = new Types.ObjectId(profileId);
    const userOid = new Types.ObjectId(userId);
    const [history, list, favorites, reactions, ratings] = await Promise.all([
      this.historyModel.find({ profileId: profileOid, userId: userOid }).exec(),
      this.listModel.find({ profileId: profileOid, userId: userOid }).exec(),
      this.favoriteModel.find({ profileId: profileOid, userId: userOid }).exec(),
      this.reactionModel.find({ profileId: profileOid, userId: userOid }).exec(),
      this.ratingModel.find({ profileId: profileOid, userId: userOid }).exec(),
    ]);

    const signals: RecommendationSignals = {
      history: history.map((item) => ({
        mediaId: item.mediaId,
        completed: item.completed,
        lastWatchedAt: item.lastWatchedAt,
        progressSeconds: item.progressSeconds,
        durationSeconds: item.durationSeconds,
      })),
      myListIds: list.map((item) => item.mediaId),
      favoriteIds: favorites.map((item) => item.mediaId),
      likes: reactions.filter((item) => item.reaction === 'like').map((item) => item.mediaId),
      dislikes: reactions.filter((item) => item.reaction === 'dislike').map((item) => item.mediaId),
      ratings: ratings.map((item) => ({ mediaId: item.mediaId, rating: item.rating })),
    };

    const seedIds = [...new Set([
      ...signals.favoriteIds,
      ...signals.likes,
      ...signals.ratings.filter((item) => item.rating >= 4).map((item) => item.mediaId),
      ...signals.myListIds,
      ...signals.history.map((item) => item.mediaId),
    ])];
    const seedDocs = await this.loadCatalogByIds(seedIds, profile.maturityLevel, profile.isKids);
    const now = Date.now();
    const seeds: TasteSeed[] = seedDocs.map((doc) => {
      const hist = signals.history.find((item) => item.mediaId === doc.mediaId);
      const recency = hist ? Math.max(0, 1 - (now - hist.lastWatchedAt.getTime()) / (30 * 86400000)) : 0;
      let reason: RecommendationReason = RecommendationReason.Watched;
      if (signals.favoriteIds.includes(doc.mediaId)) reason = RecommendationReason.Favorite;
      else if (signals.ratings.some((item) => item.mediaId === doc.mediaId && item.rating >= 4)) {
        reason = RecommendationReason.Rated;
      } else if (signals.likes.includes(doc.mediaId)) reason = RecommendationReason.Rated;
      else if (hist && !hist.completed) reason = RecommendationReason.Continue;
      else if (signals.myListIds.includes(doc.mediaId)) reason = RecommendationReason.MyList;
      return {
        mediaId: doc.mediaId,
        genres: doc.genres,
        cast: doc.cast,
        directors: doc.directors,
        weight: seedWeight({
          favorite: signals.favoriteIds.includes(doc.mediaId),
          liked: signals.likes.includes(doc.mediaId),
          rating: signals.ratings.find((item) => item.mediaId === doc.mediaId)?.rating,
          listed: signals.myListIds.includes(doc.mediaId),
          completed: hist?.completed,
          recency,
        }),
        reason,
      };
    });

    const genres = topGenres(genreAffinity(seeds), 5);
    const candidates = await this.loadCandidates(genres, profile.maturityLevel, profile.isKids, seedIds);
    const ranked = rankRecommendations(candidates, seeds, signals, RESULT_LIMIT);

    await this.recommendationModel.deleteMany({ profileId: profileOid, userId: userOid });
    const items: RecommendationItem[] = [];
    if (ranked.length) {
      const docs = await this.recommendationModel.insertMany(
        ranked.map((value) => ({
          profileId: profileOid,
          userId: userOid,
          mediaId: value.mediaId,
          score: value.score,
          reason: value.reason,
          strategy: value.strategy ?? RecommendationStrategy.Content,
          sourceMediaId: value.sourceMediaId,
        })),
      );
      items.push(...docs.map((row) => toPublic(row as RecommendationDocument)));
    }
    await this.redis.client.set(recommendationsCacheKey(profileId), JSON.stringify(items), 'PX', REC_CACHE_MS);
    await invalidateHomeProfileCache(this.redis.client, profileId);
    return items;
  }

  async dislikedIds(userId: string, profileId: string): Promise<Set<string>> {
    const rows = await this.reactionModel
      .find({
        profileId: new Types.ObjectId(profileId),
        userId: new Types.ObjectId(userId),
        reaction: 'dislike',
      })
      .select('mediaId')
      .lean();
    return new Set(rows.map((row) => row.mediaId));
  }

  async completedIds(userId: string, profileId: string): Promise<Set<string>> {
    const rows = await this.historyModel
      .find({
        profileId: new Types.ObjectId(profileId),
        userId: new Types.ObjectId(userId),
        completed: true,
      })
      .select('mediaId')
      .lean();
    return new Set(rows.map((row) => row.mediaId));
  }

  private visibility(maturity: MaturityLevel, isKids: boolean) {
    const cap = isKids ? MaturityLevel.Kids : maturity;
    const allowed = (Object.keys(MATURITY_RANK) as MaturityLevel[]).filter(
      (level) => MATURITY_RANK[level] <= MATURITY_RANK[cap],
    );
    return { published: true, maturityRating: { $in: allowed } };
  }

  private async loadCatalogByIds(
    ids: string[],
    maturity: MaturityLevel,
    isKids: boolean,
  ): Promise<CatalogCandidate[]> {
    const objectIds = ids.filter((id) => Types.ObjectId.isValid(id) && id.length === 24).map((id) => new Types.ObjectId(id));
    if (objectIds.length === 0) {
      return [];
    }
    const filter = { ...this.visibility(maturity, isKids), _id: { $in: objectIds } };
    const [movies, series] = await Promise.all([
      this.movieModel.find(filter).limit(60),
      this.seriesModel.find(filter).limit(60),
    ]);
    return [...movies.map(movieCandidate), ...series.map(seriesCandidate)];
  }

  private async loadCandidates(
    genres: string[],
    maturity: MaturityLevel,
    isKids: boolean,
    seedIds: string[],
  ): Promise<CatalogCandidate[]> {
    const base = this.visibility(maturity, isKids);
    const genreFilter = genres.length ? { ...base, genres: { $in: genres } } : base;
    const [movies, series] = await Promise.all([
      this.movieModel.find(genreFilter).sort({ popular: -1, trending: -1, createdAt: -1 }).limit(CATALOG_LIMIT),
      this.seriesModel.find(genreFilter).sort({ popular: -1, trending: -1, createdAt: -1 }).limit(CATALOG_LIMIT),
    ]);
    const seedSet = new Set(seedIds);
    return [...movies.map(movieCandidate), ...series.map(seriesCandidate)].filter((item) => !seedSet.has(item.mediaId));
  }
}

function movieCandidate(movie: MovieDocument): CatalogCandidate {
  return {
    mediaId: String(movie._id),
    genres: movie.genres ?? [],
    cast: (movie.cast ?? []).map((member) => member.name.toLowerCase()),
    directors: (movie.directors ?? []).map((name) => name.toLowerCase()),
    popular: movie.popular,
    trending: movie.trending,
    featured: movie.featured,
    imdb: movie.ratings?.imdb ?? null,
  };
}

function seriesCandidate(series: SeriesDocument): CatalogCandidate {
  return {
    mediaId: String(series._id),
    genres: series.genres ?? [],
    cast: (series.cast ?? []).map((member) => member.name.toLowerCase()),
    directors: (series.directors ?? []).map((name) => name.toLowerCase()),
    popular: series.popular,
    trending: series.trending,
    featured: series.featured,
    imdb: series.ratings?.imdb ?? null,
  };
}

function toPublic(row: RecommendationDocument): RecommendationItem {
  return {
    id: String(row._id),
    profileId: String(row.profileId),
    mediaId: row.mediaId,
    score: row.score,
    reason: row.reason,
    strategy: row.strategy ?? RecommendationStrategy.Content,
    sourceMediaId: row.sourceMediaId ?? null,
  };
}
