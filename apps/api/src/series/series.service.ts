import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  BulkEpisodeAction,
  BulkSeriesAction,
  ErrorCode,
  MATURITY_RANK,
  MediaAssetStatus,
  MediaKind,
  MovieAvailability,
  MaturityLevel,
  SeriesSort,
  profileCanViewMaturity,
  type EpisodeDetailResponse,
  type EpisodeNeighbor,
  type EpisodePlaybackResponse,
  type EpisodeProgressResponse,
  type PublicSeries,
  type PublicSeriesCollection,
  type SeasonDetailResponse,
  type SeriesCatalogResponse,
  type SeriesContinueItem,
  type SeriesDetailResponse,
  type SeriesListResponse,
  type SubscriptionEntitlement,
  type VideoQuality,
  type WatchProgress,
} from '@movie-server/shared';
import { RequestUser } from '../auth/auth.types';
import { ProfilesService } from '../profiles/profiles.service';
import { WatchHistoryService } from '../profiles/watch-history.service';
import { SubscriptionAccessService } from '../subscriptions/subscription-access.service';
import { ArtworkStorageService } from '../movies/artwork-storage.service';
import { sniffImageMime } from '../common/security/image-bytes';
import { MediaAsset, MediaAssetDocument } from '../movies/schemas/media-asset.schema';
import { CreateMediaAssetDto, UpdateMediaAssetDto } from '../movies/dto/media-asset.dto';
import { toAdminMediaAsset, toPublicMediaAsset } from '../movies/movie.mapper';
import { escapeRegex, looksLikeFilesystemPath, newStorageKey, slugify } from '../movies/movie.util';
import { buildEpisodeSearchFields, buildMediaSearchFields } from '../common/search-fields';
import { Series, SeriesDocument } from './schemas/series.schema';
import { SeriesCollection, SeriesCollectionDocument } from './schemas/series-collection.schema';
import { Season, SeasonDocument } from './schemas/season.schema';
import { Episode, EpisodeDocument } from './schemas/episode.schema';
import { QuerySeriesDto } from './dto/query-series.dto';
import { UpdateSeriesDto, UpsertSeriesDto } from './dto/upsert-series.dto';
import { UpdateSeasonDto, UpsertSeasonDto } from './dto/season.dto';
import { UpdateEpisodeDto, UpsertEpisodeDto } from './dto/episode.dto';
import { UpdateSeriesCollectionDto, UpsertSeriesCollectionDto } from './dto/collection.dto';
import { toPublicCollection, toPublicEpisode, toPublicSeason, toPublicSeries } from './series.mapper';
import { StreamService } from '../stream/stream.service';
import { foldMarkerFields } from '../stream/playback-markers.util';
import { LibraryExclusionService } from '../library/library-exclusion.service';

const SHELF_LIMIT = 12;
type SeriesFilter = Record<string, unknown>;

@Injectable()
export class SeriesService {
  constructor(
    @InjectModel(Series.name) private readonly seriesModel: Model<SeriesDocument>,
    @InjectModel(SeriesCollection.name)
    private readonly collectionModel: Model<SeriesCollectionDocument>,
    @InjectModel(Season.name) private readonly seasonModel: Model<SeasonDocument>,
    @InjectModel(Episode.name) private readonly episodeModel: Model<EpisodeDocument>,
    @InjectModel(MediaAsset.name) private readonly assetModel: Model<MediaAssetDocument>,
    private readonly profiles: ProfilesService,
    private readonly history: WatchHistoryService,
    private readonly access: SubscriptionAccessService,
    private readonly artwork: ArtworkStorageService,
    private readonly streams: StreamService,
    private readonly libraryExclusions: LibraryExclusionService,
  ) {}

  async resolveViewer(user: RequestUser): Promise<{ maturity: MaturityLevel; isKids: boolean }> {
    if (!user.activeProfileId) {
      return { maturity: MaturityLevel.Mature, isKids: false };
    }
    try {
      const profile = await this.profiles.get(user.id, user.activeProfileId);
      return { maturity: profile.maturityLevel, isKids: profile.isKids };
    } catch {
      return { maturity: MaturityLevel.Mature, isKids: false };
    }
  }

  private requireProfile(user: RequestUser): string {
    if (!user.activeProfileId) {
      throw new BadRequestException({
        error: ErrorCode.ValidationFailed,
        message: 'Select a profile before tracking playback.',
      });
    }
    return user.activeProfileId;
  }

  private maturityFilter(maturity: MaturityLevel, isKids: boolean): SeriesFilter {
    const cap = isKids ? MaturityLevel.Kids : maturity;
    const allowed = (Object.keys(MATURITY_RANK) as MaturityLevel[]).filter(
      (level) => MATURITY_RANK[level] <= MATURITY_RANK[cap],
    );
    return { maturityRating: { $in: allowed } };
  }

  private rejectPathFields(payload: Record<string, unknown>): void {
    const forbidden = ['filePath', 'storagePath', 'path', 'filepath', 'fullPath', 'absolutePath'];
    for (const key of Object.keys(payload)) {
      if (forbidden.includes(key) || looksLikeFilesystemPath(payload[key])) {
        throw new BadRequestException({
          error: ErrorCode.ValidationFailed,
          message: 'Filesystem paths are not accepted.',
        });
      }
    }
  }

  private async uniqueSlug(title: string, excludeId?: string): Promise<string> {
    const base = slugify(title);
    let slug = base;
    let n = 2;
    for (;;) {
      const existing = await this.seriesModel.findOne({
        slug,
        ...(excludeId ? { _id: { $ne: new Types.ObjectId(excludeId) } } : {}),
      });
      if (!existing) {
        return slug;
      }
      slug = `${base}-${n}`;
      n += 1;
    }
  }

  private async uniqueCollectionSlug(name: string, excludeId?: string): Promise<string> {
    const base = slugify(name);
    let slug = base;
    let n = 2;
    for (;;) {
      const existing = await this.collectionModel.findOne({
        slug,
        ...(excludeId ? { _id: { $ne: new Types.ObjectId(excludeId) } } : {}),
      });
      if (!existing) {
        return slug;
      }
      slug = `${base}-${n}`;
      n += 1;
    }
  }

  private seriesNotFound(): never {
    throw new NotFoundException({ error: ErrorCode.SeriesNotFound, message: 'Series not found.' });
  }

  private seasonNotFound(): never {
    throw new NotFoundException({ error: ErrorCode.SeasonNotFound, message: 'Season not found.' });
  }

  private episodeNotFound(): never {
    throw new NotFoundException({ error: ErrorCode.EpisodeNotFound, message: 'Episode not found.' });
  }

  private async revokeSeriesPlayback(seriesId: string): Promise<void> {
    const episodes = await this.episodeModel.find({ seriesId: new Types.ObjectId(seriesId) }).select('_id');
    await this.streams.revokeMedia(episodes.map((item) => String(item._id)));
  }

  private async revokeSeasonPlayback(seasonId: string): Promise<void> {
    const episodes = await this.episodeModel.find({ seasonId: new Types.ObjectId(seasonId) }).select('_id');
    await this.streams.revokeMedia(episodes.map((item) => String(item._id)));
  }

  async findSeries(idOrSlug: string): Promise<SeriesDocument | null> {
    if (Types.ObjectId.isValid(idOrSlug) && idOrSlug.length === 24) {
      const byId = await this.seriesModel.findById(idOrSlug);
      if (byId) return byId;
    }
    return this.seriesModel.findOne({ slug: idOrSlug.toLowerCase() });
  }

  private async assertVisibleSeries(
    idOrSlug: string,
    viewer: { maturity: MaturityLevel; isKids: boolean },
    admin = false,
  ): Promise<SeriesDocument> {
    const series = await this.findSeries(idOrSlug);
    if (!series) this.seriesNotFound();
    if (
      !admin &&
      (!series.published || !profileCanViewMaturity(viewer.maturity, series.maturityRating, viewer.isKids))
    ) {
      this.seriesNotFound();
    }
    return series;
  }

  private buildFilter(
    query: QuerySeriesDto,
    options: { admin: boolean; maturity?: MaturityLevel; isKids?: boolean },
  ): SeriesFilter {
    const filter: SeriesFilter = {};
    if (!options.admin) {
      filter.published = true;
      Object.assign(filter, this.maturityFilter(options.maturity ?? MaturityLevel.Mature, Boolean(options.isKids)));
    } else if (query.published !== undefined) {
      filter.published = query.published;
    }
    if (query.genre) filter.genres = query.genre;
    if (query.tag) filter.tags = query.tag;
    if (query.year) filter.firstAirYear = query.year;
    if (query.collection) filter.collectionId = new Types.ObjectId(query.collection);
    if (query.featured !== undefined) filter.featured = query.featured;
    if (query.trending !== undefined) filter.trending = query.trending;
    if (query.popular !== undefined) filter.popular = query.popular;
    const q = query.q?.trim();
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [
        { title: rx },
        { originalTitle: rx },
        { description: rx },
        { tags: rx },
        { genres: rx },
        { directors: rx },
        { 'cast.name': rx },
      ];
    }
    return filter;
  }

  private sortSpec(sort?: SeriesSort): Record<string, 1 | -1> {
    switch (sort) {
      case SeriesSort.Title:
        return { title: 1 };
      case SeriesSort.Year:
        return { firstAirYear: -1, title: 1 };
      case SeriesSort.Featured:
        return { featured: -1, trending: -1, popular: -1, createdAt: -1 };
      default:
        return { createdAt: -1 };
    }
  }

  private async countsFor(ids: Types.ObjectId[]): Promise<Map<string, { seasons: number; episodes: number }>> {
    const map = new Map<string, { seasons: number; episodes: number }>();
    if (ids.length === 0) return map;
    const [seasons, episodes] = await Promise.all([
      this.seasonModel.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { seriesId: { $in: ids } } },
        { $group: { _id: '$seriesId', count: { $sum: 1 } } },
      ]),
      this.episodeModel.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { seriesId: { $in: ids } } },
        { $group: { _id: '$seriesId', count: { $sum: 1 } } },
      ]),
    ]);
    for (const id of ids) {
      map.set(String(id), { seasons: 0, episodes: 0 });
    }
    for (const row of seasons) {
      const current = map.get(String(row._id)) ?? { seasons: 0, episodes: 0 };
      current.seasons = row.count;
      map.set(String(row._id), current);
    }
    for (const row of episodes) {
      const current = map.get(String(row._id)) ?? { seasons: 0, episodes: 0 };
      current.episodes = row.count;
      map.set(String(row._id), current);
    }
    return map;
  }

  private mapSeries(docs: SeriesDocument[], counts: Map<string, { seasons: number; episodes: number }>): PublicSeries[] {
    return docs.map((doc) => toPublicSeries(doc, counts.get(String(doc._id))));
  }

  async list(
    query: QuerySeriesDto,
    options: { admin: boolean; maturity?: MaturityLevel; isKids?: boolean },
  ): Promise<SeriesListResponse> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 50);
    const filter = this.buildFilter(query, options);
    const [total, items] = await Promise.all([
      this.seriesModel.countDocuments(filter),
      this.seriesModel.find(filter).sort(this.sortSpec(query.sort)).skip((page - 1) * limit).limit(limit),
    ]);
    const counts = await this.countsFor(items.map((item) => item._id));
    return {
      items: this.mapSeries(items, counts),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async catalog(
    viewer: { maturity: MaturityLevel; isKids: boolean },
  ): Promise<SeriesCatalogResponse> {
    const base: SeriesFilter = { published: true, ...this.maturityFilter(viewer.maturity, viewer.isKids) };
    const [featured, trending, popular, newest, collectionDocs] = await Promise.all([
      this.seriesModel.find({ ...base, featured: true }).sort({ createdAt: -1 }).limit(SHELF_LIMIT),
      this.seriesModel.find({ ...base, trending: true }).sort({ createdAt: -1 }).limit(SHELF_LIMIT),
      this.seriesModel.find({ ...base, popular: true }).sort({ createdAt: -1 }).limit(SHELF_LIMIT),
      this.seriesModel.find(base).sort({ createdAt: -1 }).limit(SHELF_LIMIT),
      this.collectionModel.find().sort({ sortOrder: 1, name: 1 }).limit(8),
    ]);
    const collectionRows = await Promise.all(
      collectionDocs.map(async (collection) => {
        const series = await this.seriesModel
          .find({ ...base, collectionId: collection._id })
          .sort({ firstAirYear: -1 })
          .limit(SHELF_LIMIT);
        return { collection, series };
      }),
    );
    const visible = collectionRows.filter((row) => row.series.length > 0);
    const all = [...featured, ...trending, ...popular, ...newest, ...visible.flatMap((row) => row.series)];
    const counts = await this.countsFor(all.map((item) => item._id));
    const map = (docs: SeriesDocument[]) => this.mapSeries(docs, counts);
    const collections = visible.map((row) => ({
      collection: toPublicCollection(row.collection, row.series.length),
      series: map(row.series),
    }));
    return {
      featured: map(featured),
      trending: map(trending),
      popular: map(popular),
      newest: map(newest),
      shelves: [
        { id: 'featured', title: 'Featured Series', items: map(featured) },
        { id: 'trending', title: 'Trending Series', items: map(trending) },
        { id: 'popular', title: 'Popular Series', items: map(popular) },
        { id: 'newest', title: 'New Series', items: map(newest) },
        ...collections.map((row) => ({ id: row.collection.id, title: row.collection.name, items: row.series })),
      ].filter((shelf) => shelf.items.length > 0),
      collections,
    };
  }

  async publicByIds(
    ids: string[],
    viewer: { maturity: MaturityLevel; isKids: boolean },
  ): Promise<PublicSeries[]> {
    const objectIds = uniqueSeriesIds(ids);
    if (objectIds.length === 0) {
      return [];
    }
    const docs = await this.seriesModel.find({
      _id: { $in: objectIds },
      published: true,
      ...this.maturityFilter(viewer.maturity, viewer.isKids),
    });
    const counts = await this.countsFor(docs.map((doc) => doc._id));
    const mapped = this.mapSeries(docs, counts);
    const byId = new Map(mapped.map((item) => [item.id, item]));
    return ids.map((id) => byId.get(id)).filter((item): item is PublicSeries => Boolean(item));
  }

  async seriesFromEpisodeIds(
    ids: string[],
    viewer: { maturity: MaturityLevel; isKids: boolean },
  ): Promise<Array<{ episodeId: string; series: PublicSeries; episodeTitle: string; seasonNumber: number; episodeNumber: number }>> {
    const objectIds = uniqueSeriesIds(ids);
    if (objectIds.length === 0) {
      return [];
    }
    const episodes = await this.episodeModel.find({
      _id: { $in: objectIds },
      published: true,
    });
    const seriesIds = [...new Set(episodes.map((item) => String(item.seriesId)))].map((id) => new Types.ObjectId(id));
    const seriesDocs = await this.seriesModel.find({
      _id: { $in: seriesIds },
      published: true,
      ...this.maturityFilter(viewer.maturity, viewer.isKids),
    });
    const counts = await this.countsFor(seriesDocs.map((doc) => doc._id));
    const seriesMap = new Map(
      this.mapSeries(seriesDocs, counts).map((item) => [item.id, item] as const),
    );
    const out: Array<{
      episodeId: string;
      series: PublicSeries;
      episodeTitle: string;
      seasonNumber: number;
      episodeNumber: number;
    }> = [];
    for (const id of ids) {
      const episode = episodes.find((item) => String(item._id) === id);
      if (!episode) continue;
      const series = seriesMap.get(String(episode.seriesId));
      if (!series) continue;
      out.push({
        episodeId: id,
        series,
        episodeTitle: episode.title,
        seasonNumber: episode.seasonNumber,
        episodeNumber: episode.episodeNumber,
      });
    }
    return out;
  }

  async getSeries(
    idOrSlug: string,
    viewer: { maturity: MaturityLevel; isKids: boolean },
    user?: RequestUser,
    admin = false,
  ): Promise<SeriesDetailResponse> {
    const series = await this.assertVisibleSeries(idOrSlug, viewer, admin);
    const seasonFilter: SeriesFilter = { seriesId: series._id };
    if (!admin) seasonFilter.published = true;
    const seasons = await this.seasonModel.find(seasonFilter).sort({ seasonNumber: 1 });
    const episodeFilter: SeriesFilter = { seriesId: series._id };
    if (!admin) episodeFilter.published = true;
    const episodeCounts = await this.episodeModel.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: episodeFilter },
      { $group: { _id: '$seasonId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(episodeCounts.map((row) => [String(row._id), row.count]));
    const totals = await this.countsFor([series._id]);
    let collection: PublicSeriesCollection | null = null;
    if (series.collectionId) {
      const doc = await this.collectionModel.findById(series.collectionId);
      if (doc) {
        const n = await this.seriesModel.countDocuments({
          collectionId: doc._id,
          ...(admin ? {} : { published: true }),
        });
        collection = toPublicCollection(doc, n);
      }
    }
    let continueEpisode = null;
    if (user?.activeProfileId) {
      const rows = await this.history.continueWatching(user.id, user.activeProfileId);
      const episodeIds = rows
        .map((row) => row.mediaId)
        .filter((id) => Types.ObjectId.isValid(id) && id.length === 24)
        .map((id) => new Types.ObjectId(id));
      if (episodeIds.length > 0) {
        const candidates = await this.episodeModel.find({
          _id: { $in: episodeIds },
          seriesId: series._id,
          ...(admin ? {} : { published: true }),
        });
        for (const row of rows) {
          const match = candidates.find((item) => String(item._id) === row.mediaId);
          if (match) {
            continueEpisode = toPublicEpisode(match, { progress: row });
            break;
          }
        }
      }
    }
    return {
      series: toPublicSeries(series, totals.get(String(series._id))),
      collection,
      seasons: seasons.map((season) => toPublicSeason(season, countMap.get(String(season._id)) ?? 0)),
      continueEpisode,
    };
  }

  async getSeason(
    seriesRef: string,
    seasonId: string,
    viewer: { maturity: MaturityLevel; isKids: boolean },
    user?: RequestUser,
    entitlement?: SubscriptionEntitlement | null,
    admin = false,
  ): Promise<SeasonDetailResponse> {
    const series = await this.assertVisibleSeries(seriesRef, viewer, admin);
    const season = await this.seasonModel.findOne({
      _id: new Types.ObjectId(seasonId),
      seriesId: series._id,
    });
    if (!season || (!admin && !season.published)) this.seasonNotFound();
    const episodeFilter: SeriesFilter = { seasonId: season._id };
    if (!admin) episodeFilter.published = true;
    const episodes = await this.episodeModel.find(episodeFilter).sort({ episodeNumber: 1 });
    const assets = await this.assetsByEpisode(episodes.map((item) => item._id));
    const progressMap =
      user?.activeProfileId
        ? await this.history.listByMediaIds(
            user.id,
            user.activeProfileId,
            episodes.map((item) => String(item._id)),
          )
        : new Map<string, WatchProgress>();
    const totals = await this.countsFor([series._id]);
    return {
      series: toPublicSeries(series, totals.get(String(series._id))),
      season: toPublicSeason(season, episodes.length),
      episodes: episodes.map((episode) =>
        toPublicEpisode(episode, {
          entitlement,
          assets: assets.get(String(episode._id)) ?? [],
          admin,
          progress: progressMap.get(String(episode._id)),
        }),
      ),
    };
  }

  async getEpisode(
    seriesRef: string,
    episodeId: string,
    viewer: { maturity: MaturityLevel; isKids: boolean },
    user?: RequestUser,
    entitlement?: SubscriptionEntitlement | null,
    admin = false,
  ): Promise<EpisodeDetailResponse> {
    const { series, season, episode, assets } = await this.loadEpisodeGraph(
      seriesRef,
      episodeId,
      viewer,
      admin,
    );
    const progress =
      user?.activeProfileId
        ? await this.history.get(user.id, user.activeProfileId, String(episode._id))
        : null;
    const neighbors = await this.neighbors(episode, admin);
    const publicAssets = assets.map((asset) => toPublicMediaAsset(asset, entitlement, admin));
    const totals = await this.countsFor([series._id]);
    return {
      series: toPublicSeries(series, totals.get(String(series._id))),
      season: toPublicSeason(season),
      episode: toPublicEpisode(episode, { entitlement, assets, admin, progress }),
      versions: publicAssets.filter((asset) => asset.kind === MediaKind.Video),
      audioTracks: publicAssets.filter((asset) => asset.kind === MediaKind.Audio),
      subtitleTracks: publicAssets.filter((asset) => asset.kind === MediaKind.Subtitle),
      previous: neighbors.previous,
      next: neighbors.next,
      autoPlayNext: series.autoPlayNext,
      ...(admin ? { assets: assets.map(toAdminMediaAsset) } : {}),
    };
  }

  async playback(
    seriesRef: string,
    episodeId: string,
    user: RequestUser,
    quality: VideoQuality,
    extras?: { currentStreamCount?: number; deviceId?: string; deviceLabel?: string },
  ): Promise<EpisodePlaybackResponse> {
    const viewer = await this.resolveViewer(user);
    const entitlement = await this.access.assertPlayback(user.id, {
      quality,
    });
    const detail = await this.getEpisode(seriesRef, episodeId, viewer, user, entitlement, false);
    if (!detail.episode.playable) {
      throw new BadRequestException({
        error: ErrorCode.FeatureNotAllowed,
        message: 'This episode is not available for playback.',
      });
    }
    const allowedVersion = detail.versions.find((item) => item.allowed);
    if (!allowedVersion) {
      throw new BadRequestException({
        error: ErrorCode.QualityNotAllowed,
        message: 'No video version is allowed on your plan.',
      });
    }
    const session = await this.streams.open({
      user,
      quality,
      deviceId: extras?.deviceId,
      deviceLabel: extras?.deviceLabel,
      episodeId,
      seriesId: detail.series.id,
      durationSeconds: Math.max(detail.episode.durationSeconds, 1),
    });
    return {
      allowed: true,
      quality,
      episode: detail.episode,
      previous: detail.previous,
      next: detail.next,
      autoPlayNext: detail.autoPlayNext,
      session,
      markers: detail.episode.markers,
      resumeSeconds: detail.episode.progressSeconds,
    };
  }

  async saveProgress(
    seriesRef: string,
    episodeId: string,
    user: RequestUser,
    dto: { progressSeconds: number; durationSeconds: number },
  ): Promise<EpisodeProgressResponse> {
    const profileId = this.requireProfile(user);
    const viewer = await this.resolveViewer(user);
    const { series, episode, assets } = await this.loadEpisodeGraph(seriesRef, episodeId, viewer, false);
    const progress = await this.history.upsert(user.id, profileId, {
      mediaId: String(episode._id),
      progressSeconds: dto.progressSeconds,
      durationSeconds: dto.durationSeconds,
    });
    const neighbors = await this.neighbors(episode, false);
    return {
      episode: toPublicEpisode(episode, { assets, progress }),
      progress,
      next: progress.completed && series.autoPlayNext ? neighbors.next : neighbors.next,
      autoPlayNext: series.autoPlayNext,
    };
  }

  async setWatched(
    seriesRef: string,
    episodeId: string,
    user: RequestUser,
    watched: boolean,
  ): Promise<EpisodeProgressResponse> {
    const profileId = this.requireProfile(user);
    const viewer = await this.resolveViewer(user);
    const { series, episode, assets } = await this.loadEpisodeGraph(seriesRef, episodeId, viewer, false);
    const duration = Math.max(episode.runtimeMinutes * 60, 1);
    if (watched) {
      const progress = await this.history.upsert(user.id, profileId, {
        mediaId: String(episode._id),
        progressSeconds: duration,
        durationSeconds: duration,
      });
      const neighbors = await this.neighbors(episode, false);
      return {
        episode: toPublicEpisode(episode, { assets, progress }),
        progress,
        next: neighbors.next,
        autoPlayNext: series.autoPlayNext,
      };
    }
    await this.history.remove(user.id, profileId, String(episode._id));
    const neighbors = await this.neighbors(episode, false);
    const empty: WatchProgress = {
      id: '',
      profileId,
      mediaId: String(episode._id),
      progressSeconds: 0,
      durationSeconds: duration,
      completed: false,
      lastWatchedAt: new Date().toISOString(),
    };
    return {
      episode: toPublicEpisode(episode, { assets, progress: empty }),
      progress: empty,
      next: neighbors.next,
      autoPlayNext: series.autoPlayNext,
    };
  }

  async continueWatching(user: RequestUser): Promise<{ items: SeriesContinueItem[] }> {
    if (!user.activeProfileId) {
      return { items: [] };
    }
    const viewer = await this.resolveViewer(user);
    const rows = await this.history.continueWatching(user.id, user.activeProfileId);
    const episodeIds = rows
      .map((row) => row.mediaId)
      .filter((id) => Types.ObjectId.isValid(id) && id.length === 24)
      .map((id) => new Types.ObjectId(id));
    if (episodeIds.length === 0) {
      return { items: [] };
    }
    const episodes = await this.episodeModel.find({
      _id: { $in: episodeIds },
      published: true,
    });
    const seriesIds = [...new Set(episodes.map((item) => String(item.seriesId)))];
    const seriesDocs = await this.seriesModel.find({
      _id: { $in: seriesIds.map((id) => new Types.ObjectId(id)) },
      published: true,
      ...this.maturityFilter(viewer.maturity, viewer.isKids),
    });
    const seriesMap = new Map(seriesDocs.map((doc) => [String(doc._id), doc]));
    const counts = await this.countsFor(seriesDocs.map((doc) => doc._id));
    const assets = await this.assetsByEpisode(episodes.map((item) => item._id));
    const items: SeriesContinueItem[] = [];
    for (const row of rows) {
      const episode = episodes.find((item) => String(item._id) === row.mediaId);
      if (!episode) continue;
      const series = seriesMap.get(String(episode.seriesId));
      if (!series) continue;
      const neighbors = await this.neighbors(episode, false);
      items.push({
        series: toPublicSeries(series, counts.get(String(series._id))),
        episode: toPublicEpisode(episode, {
          assets: assets.get(String(episode._id)) ?? [],
          progress: row,
        }),
        progress: row,
        next: neighbors.next,
      });
    }
    return { items };
  }

  async listPublicCollections(viewer: {
    maturity: MaturityLevel;
    isKids: boolean;
  }): Promise<PublicSeriesCollection[]> {
    const collections = await this.collectionModel.find().sort({ sortOrder: 1, name: 1 });
    const counts = await this.publishedCollectionCounts({
      published: true,
      ...this.maturityFilter(viewer.maturity, viewer.isKids),
    });
    return collections
      .map((collection) => toPublicCollection(collection, counts.get(String(collection._id)) ?? 0))
      .filter((item) => item.seriesCount > 0);
  }

  private async publishedCollectionCounts(filter: SeriesFilter): Promise<Map<string, number>> {
    const rows = await this.seriesModel.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { ...filter, collectionId: { $ne: null } } },
      { $group: { _id: '$collectionId', count: { $sum: 1 } } },
    ]);
    return new Map(rows.map((row) => [String(row._id), row.count]));
  }

  private async loadEpisodeGraph(
    seriesRef: string,
    episodeId: string,
    viewer: { maturity: MaturityLevel; isKids: boolean },
    admin: boolean,
  ) {
    const series = await this.assertVisibleSeries(seriesRef, viewer, admin);
    const episode = await this.episodeModel.findOne({
      _id: new Types.ObjectId(episodeId),
      seriesId: series._id,
    });
    if (!episode || (!admin && !episode.published)) this.episodeNotFound();
    const season = await this.seasonModel.findById(episode.seasonId);
    if (!season || (!admin && !season.published)) this.seasonNotFound();
    const assets = await this.assetModel
      .find({ episodeId: episode._id })
      .select('-storagePath')
      .sort({ sortOrder: 1, createdAt: 1 });
    return { series, season, episode, assets };
  }

  private async neighbors(episode: EpisodeDocument, admin: boolean): Promise<{
    previous: EpisodeNeighbor | null;
    next: EpisodeNeighbor | null;
  }> {
    const filter: SeriesFilter = { seriesId: episode.seriesId };
    if (!admin) filter.published = true;
    const all = await this.episodeModel
      .find(filter)
      .select('title seasonNumber episodeNumber')
      .sort({ seasonNumber: 1, episodeNumber: 1 });
    const index = all.findIndex((item) => String(item._id) === String(episode._id));
    const toRef = (doc?: EpisodeDocument | null): EpisodeNeighbor | null =>
      doc
        ? {
            id: String(doc._id),
            seasonNumber: doc.seasonNumber,
            episodeNumber: doc.episodeNumber,
            title: doc.title,
          }
        : null;
    return {
      previous: index > 0 ? toRef(all[index - 1]) : null,
      next: index >= 0 && index < all.length - 1 ? toRef(all[index + 1]) : null,
    };
  }

  private async assetsByEpisode(ids: Types.ObjectId[]): Promise<Map<string, MediaAssetDocument[]>> {
    const map = new Map<string, MediaAssetDocument[]>();
    if (ids.length === 0) return map;
    const assets = await this.assetModel
      .find({ episodeId: { $in: ids } })
      .select('-storagePath')
      .sort({ sortOrder: 1, createdAt: 1 });
    for (const asset of assets) {
      const key = String(asset.episodeId);
      const list = map.get(key) ?? [];
      list.push(asset);
      map.set(key, list);
    }
    return map;
  }

  async createSeries(dto: UpsertSeriesDto): Promise<SeriesDocument> {
    this.rejectPathFields(dto as unknown as Record<string, unknown>);
    if (dto.collectionId) await this.requireCollection(dto.collectionId);
    const published = Boolean(dto.published);
    return this.seriesModel.create({
      slug: dto.slug ?? (await this.uniqueSlug(dto.title)),
      title: dto.title,
      originalTitle: dto.originalTitle ?? null,
      description: dto.description,
      posterUrl: dto.posterUrl ?? null,
      backdropUrl: dto.backdropUrl ?? null,
      firstAirYear: dto.firstAirYear,
      lastAirYear: dto.lastAirYear ?? null,
      genres: dto.genres,
      tags: (dto.tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean),
      cast: (dto.cast ?? []).map((member, index) => ({
        name: member.name,
        character: member.character ?? null,
        order: member.order ?? index,
        imageUrl: member.imageUrl ?? null,
      })),
      directors: dto.directors ?? [],
      ratings: dto.ratings ?? {},
      maturityRating: dto.maturityRating,
      certification: dto.certification ?? null,
      collectionId: dto.collectionId ? new Types.ObjectId(dto.collectionId) : null,
      featured: Boolean(dto.featured),
      trending: Boolean(dto.trending),
      popular: Boolean(dto.popular),
      published,
      publishedAt: published ? new Date() : null,
      availability: dto.availability ?? MovieAvailability.Unavailable,
      status: dto.status ?? 'returning',
      autoPlayNext: dto.autoPlayNext ?? true,
    });
  }

  async updateSeries(id: string, dto: UpdateSeriesDto): Promise<SeriesDocument> {
    this.rejectPathFields(dto as unknown as Record<string, unknown>);
    const series = await this.seriesModel.findById(id);
    if (!series) this.seriesNotFound();
    if (dto.collectionId) await this.requireCollection(dto.collectionId);
    const $set: Record<string, unknown> = { ...dto };
    if (dto.collectionId === null) $set.collectionId = null;
    else if (dto.collectionId) $set.collectionId = new Types.ObjectId(dto.collectionId);
    if (dto.tags) $set.tags = dto.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean);
    if (dto.published === true && !series.published) $set.publishedAt = new Date();
    if (dto.published === false) $set.publishedAt = null;
    if (dto.posterUrl !== undefined) $set.posterKey = null;
    if (dto.backdropUrl !== undefined) $set.backdropKey = null;
    Object.assign(
      $set,
      buildMediaSearchFields({
        title: typeof $set.title === 'string' ? $set.title : series.title,
        originalTitle:
          $set.originalTitle !== undefined ? ($set.originalTitle as string | null) : series.originalTitle,
        cast: ($set.cast as Series['cast'] | undefined) ?? series.cast,
        directors: ($set.directors as string[] | undefined) ?? series.directors,
      }),
    );
    const updated = await this.seriesModel.findByIdAndUpdate(id, { $set }, { returnDocument: 'after' });
    if (!updated) this.seriesNotFound();
    if (series.published && !updated.published) {
      await this.revokeSeriesPlayback(id);
    }
    return updated;
  }

  async removeSeries(id: string): Promise<void> {
    await this.revokeSeriesPlayback(id);
    const series = await this.seriesModel.findById(id);
    if (!series) this.seriesNotFound();
    await this.libraryExclusions.ignoreSeriesLinks([{ id: series._id, title: series.title }]);
    await this.seriesModel.findByIdAndDelete(id);
    const episodes = await this.episodeModel.find({ seriesId: series._id });
    const episodeIds = episodes.map((item) => item._id);
    await this.seasonModel.deleteMany({ seriesId: series._id });
    await this.episodeModel.deleteMany({ seriesId: series._id });
    await this.assetModel.deleteMany({ episodeId: { $in: episodeIds } });
    await Promise.all([
      this.artwork.remove(series.posterKey),
      this.artwork.remove(series.backdropKey),
      ...episodes.map((item) => this.artwork.remove(item.thumbnailKey)),
    ]);
  }

  async bulkSeries(ids: string[], action: BulkSeriesAction): Promise<{ matched: number }> {
    const objectIds = ids.map((id) => new Types.ObjectId(id));
    const filter = { _id: { $in: objectIds } };
    if (action === BulkSeriesAction.Delete) {
      const docs = await this.seriesModel.find(filter);
      for (const doc of docs) {
        await this.removeSeries(String(doc._id));
      }
      return { matched: docs.length };
    }
    const $set: Record<string, unknown> = {};
    if (action === BulkSeriesAction.Publish) {
      $set.published = true;
      $set.publishedAt = new Date();
    } else if (action === BulkSeriesAction.Unpublish) {
      $set.published = false;
      $set.publishedAt = null;
    } else if (action === BulkSeriesAction.Feature) $set.featured = true;
    else if (action === BulkSeriesAction.Unfeature) $set.featured = false;
    else if (action === BulkSeriesAction.Trending) $set.trending = true;
    else if (action === BulkSeriesAction.Untrending) $set.trending = false;
    else if (action === BulkSeriesAction.Popular) $set.popular = true;
    else if (action === BulkSeriesAction.Unpopular) $set.popular = false;
    const result = await this.seriesModel.updateMany(filter, { $set });
    if (action === BulkSeriesAction.Unpublish) {
      await Promise.all(ids.map((id) => this.revokeSeriesPlayback(id)));
    }
    return { matched: result.modifiedCount };
  }

  async createSeason(seriesId: string, dto: UpsertSeasonDto): Promise<SeasonDocument> {
    this.rejectPathFields(dto as unknown as Record<string, unknown>);
    const series = await this.seriesModel.findById(seriesId);
    if (!series) this.seriesNotFound();
    return this.seasonModel.create({
      seriesId: series._id,
      seasonNumber: dto.seasonNumber,
      name: dto.name ?? (dto.seasonNumber === 0 ? 'Specials' : `Season ${dto.seasonNumber}`),
      description: dto.description ?? '',
      posterUrl: dto.posterUrl ?? null,
      airDate: dto.airDate ? new Date(dto.airDate) : null,
      published: Boolean(dto.published),
    });
  }

  async updateSeason(seriesId: string, seasonId: string, dto: UpdateSeasonDto): Promise<SeasonDocument> {
    this.rejectPathFields(dto as unknown as Record<string, unknown>);
    const $set: Record<string, unknown> = { ...dto };
    if (dto.airDate) $set.airDate = new Date(dto.airDate);
    if (dto.airDate === null) $set.airDate = null;
    if (dto.posterUrl !== undefined) $set.posterKey = null;
    const season = await this.seasonModel.findOneAndUpdate(
      { _id: new Types.ObjectId(seasonId), seriesId: new Types.ObjectId(seriesId) },
      { $set },
      { returnDocument: 'after' },
    );
    if (!season) this.seasonNotFound();
    if (dto.published === false) {
      await this.revokeSeasonPlayback(String(season._id));
    }
    if (dto.seasonNumber !== undefined && dto.seasonNumber !== season.seasonNumber) {
      await this.episodeModel.updateMany({ seasonId: season._id }, { $set: { seasonNumber: dto.seasonNumber } });
    }
    return season;
  }

  async removeSeason(seriesId: string, seasonId: string): Promise<void> {
    const season = await this.seasonModel.findOneAndDelete({
      _id: new Types.ObjectId(seasonId),
      seriesId: new Types.ObjectId(seriesId),
    });
    if (!season) this.seasonNotFound();
    const episodes = await this.episodeModel.find({ seasonId: season._id });
    await this.streams.revokeMedia(episodes.map((item) => String(item._id)));
    await this.episodeModel.deleteMany({ seasonId: season._id });
    await this.assetModel.deleteMany({ episodeId: { $in: episodes.map((item) => item._id) } });
    await Promise.all([
      this.artwork.remove(season.posterKey),
      ...episodes.map((item) => this.artwork.remove(item.thumbnailKey)),
    ]);
  }

  async createEpisode(seriesId: string, seasonId: string, dto: UpsertEpisodeDto): Promise<EpisodeDocument> {
    this.rejectPathFields(dto as unknown as Record<string, unknown>);
    const season = await this.seasonModel.findOne({
      _id: new Types.ObjectId(seasonId),
      seriesId: new Types.ObjectId(seriesId),
    });
    if (!season) this.seasonNotFound();
    return this.episodeModel.create({
      seriesId: season.seriesId,
      seasonId: season._id,
      seasonNumber: season.seasonNumber,
      episodeNumber: dto.episodeNumber,
      title: dto.title,
      description: dto.description,
      thumbnailUrl: dto.thumbnailUrl ?? null,
      runtimeMinutes: dto.runtimeMinutes,
      airDate: dto.airDate ? new Date(dto.airDate) : null,
      published: Boolean(dto.published),
      availability: dto.availability ?? MovieAvailability.Unavailable,
    });
  }

  async createEpisodes(seriesId: string, seasonId: string, dtos: UpsertEpisodeDto[]): Promise<EpisodeDocument[]> {
    const created: EpisodeDocument[] = [];
    for (const dto of dtos) {
      created.push(await this.createEpisode(seriesId, seasonId, dto));
    }
    return created;
  }

  async updateEpisode(
    seriesId: string,
    seasonId: string,
    episodeId: string,
    dto: UpdateEpisodeDto,
  ): Promise<EpisodeDocument> {
    this.rejectPathFields(dto as unknown as Record<string, unknown>);
    const $set: Record<string, unknown> = foldMarkerFields({ ...dto });
    if (dto.airDate) $set.airDate = new Date(dto.airDate);
    if (dto.airDate === null) $set.airDate = null;
    if (dto.thumbnailUrl !== undefined) $set.thumbnailKey = null;
    if (dto.title) {
      Object.assign($set, buildEpisodeSearchFields(dto.title));
    }
    const episode = await this.episodeModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(episodeId),
        seasonId: new Types.ObjectId(seasonId),
        seriesId: new Types.ObjectId(seriesId),
      },
      { $set },
      { returnDocument: 'after' },
    );
    if (!episode) this.episodeNotFound();
    if (dto.published === false) {
      await this.streams.revokeMedia([episodeId]);
    }
    return episode;
  }

  async removeEpisode(seriesId: string, seasonId: string, episodeId: string): Promise<void> {
    await this.streams.revokeMedia([episodeId]);
    const episode = await this.episodeModel.findOneAndDelete({
      _id: new Types.ObjectId(episodeId),
      seasonId: new Types.ObjectId(seasonId),
      seriesId: new Types.ObjectId(seriesId),
    });
    if (!episode) this.episodeNotFound();
    await this.assetModel.deleteMany({ episodeId: episode._id });
    await this.artwork.remove(episode.thumbnailKey);
  }

  async bulkEpisodes(seriesId: string, seasonId: string, ids: string[], action: BulkEpisodeAction) {
    const objectIds = ids.map((id) => new Types.ObjectId(id));
    const filter = {
      _id: { $in: objectIds },
      seriesId: new Types.ObjectId(seriesId),
      seasonId: new Types.ObjectId(seasonId),
    };
    if (action === BulkEpisodeAction.Delete) {
      const episodes = await this.episodeModel.find(filter);
      await this.streams.revokeMedia(episodes.map((item) => String(item._id)));
      await this.episodeModel.deleteMany(filter);
      await this.assetModel.deleteMany({ episodeId: { $in: objectIds } });
      await Promise.all(episodes.map((item) => this.artwork.remove(item.thumbnailKey)));
      return { matched: episodes.length };
    }
    const result = await this.episodeModel.updateMany(filter, {
      $set: { published: action === BulkEpisodeAction.Publish },
    });
    if (action === BulkEpisodeAction.Unpublish) {
      await this.streams.revokeMedia(ids);
    }
    return { matched: result.modifiedCount };
  }

  async addMedia(episodeId: string, dto: CreateMediaAssetDto): Promise<MediaAssetDocument> {
    this.rejectPathFields(dto as unknown as Record<string, unknown>);
    const episode = await this.episodeModel.findById(episodeId);
    if (!episode) this.episodeNotFound();
    if (dto.kind === MediaKind.Video && !dto.quality) {
      throw new BadRequestException({
        error: ErrorCode.ValidationFailed,
        message: 'Video versions require a quality (480p, 720p, 1080p, or 4k).',
      });
    }
    const isDefault =
      dto.isDefault ??
      ((await this.assetModel.countDocuments({ episodeId: episode._id, kind: dto.kind })) === 0);
    if (isDefault) {
      await this.assetModel.updateMany(
        { episodeId: episode._id, kind: dto.kind },
        { $set: { isDefault: false } },
      );
    }
    const asset = await this.assetModel.create({
      movieId: null,
      episodeId: episode._id,
      kind: dto.kind,
      storageKey: newStorageKey(),
      quality: dto.kind === MediaKind.Video ? dto.quality : null,
      language: dto.language ?? null,
      label: dto.label ?? null,
      codec: dto.codec ?? null,
      channels: dto.channels ?? null,
      format: dto.kind === MediaKind.Subtitle ? dto.format ?? null : null,
      bitrateKbps: dto.bitrateKbps ?? null,
      forced: Boolean(dto.forced),
      hearingImpaired: Boolean(dto.hearingImpaired),
      isDefault,
      sortOrder: dto.sortOrder ?? 0,
      status: dto.status ?? MediaAssetStatus.Missing,
    });
    await this.refreshEpisodeAvailability(episode._id);
    return asset;
  }

  async updateMedia(episodeId: string, assetId: string, dto: UpdateMediaAssetDto): Promise<MediaAssetDocument> {
    this.rejectPathFields(dto as unknown as Record<string, unknown>);
    const asset = await this.assetModel.findOne({
      _id: new Types.ObjectId(assetId),
      episodeId: new Types.ObjectId(episodeId),
    });
    if (!asset) {
      throw new NotFoundException({ error: ErrorCode.MediaNotFound, message: 'Media asset not found.' });
    }
    if (dto.isDefault) {
      await this.assetModel.updateMany(
        { episodeId: asset.episodeId, kind: asset.kind, _id: { $ne: asset._id } },
        { $set: { isDefault: false } },
      );
    }
    const updated = await this.assetModel.findByIdAndUpdate(asset._id, { $set: dto }, { returnDocument: 'after' });
    if (!updated) {
      throw new NotFoundException({ error: ErrorCode.MediaNotFound, message: 'Media asset not found.' });
    }
    await this.refreshEpisodeAvailability(new Types.ObjectId(episodeId));
    return updated;
  }

  async removeMedia(episodeId: string, assetId: string): Promise<void> {
    const asset = await this.assetModel.findOneAndDelete({
      _id: new Types.ObjectId(assetId),
      episodeId: new Types.ObjectId(episodeId),
    });
    if (!asset) {
      throw new NotFoundException({ error: ErrorCode.MediaNotFound, message: 'Media asset not found.' });
    }
    await this.refreshEpisodeAvailability(new Types.ObjectId(episodeId));
  }

  async attachArtwork(
    target: { seriesId?: string; seasonId?: string; episodeId?: string },
    slot: 'poster' | 'backdrop' | 'thumbnail',
    file: { mimetype: string; buffer: Buffer; size: number },
  ) {
    const mime = sniffImageMime(file.buffer);
    if (!mime || !this.artwork.isAllowed(mime)) {
      throw new BadRequestException({
        error: ErrorCode.ValidationFailed,
        message: 'Artwork must be JPEG, PNG, or WebP.',
      });
    }
    if (file.size > this.artwork.maxBytes()) {
      throw new BadRequestException({
        error: ErrorCode.ValidationFailed,
        message: 'Artwork is too large.',
      });
    }
    const key = await this.artwork.save({ mimetype: mime, buffer: file.buffer });
    if (target.episodeId) {
      const episode = await this.episodeModel.findById(target.episodeId);
      if (!episode) this.episodeNotFound();
      await this.artwork.remove(episode.thumbnailKey);
      episode.thumbnailKey = key;
      episode.thumbnailUrl = null;
      await episode.save();
      return episode;
    }
    if (target.seasonId) {
      const season = await this.seasonModel.findById(target.seasonId);
      if (!season) this.seasonNotFound();
      await this.artwork.remove(season.posterKey);
      season.posterKey = key;
      season.posterUrl = null;
      await season.save();
      return season;
    }
    const series = await this.seriesModel.findById(target.seriesId);
    if (!series) this.seriesNotFound();
    if (slot === 'backdrop') {
      await this.artwork.remove(series.backdropKey);
      series.backdropKey = key;
      series.backdropUrl = null;
    } else {
      await this.artwork.remove(series.posterKey);
      series.posterKey = key;
      series.posterUrl = null;
    }
    await series.save();
    return series;
  }

  async findArtworkOwner(key: string): Promise<{ published: boolean } | null> {
    const series = await this.seriesModel.findOne({ $or: [{ posterKey: key }, { backdropKey: key }] });
    if (series) return { published: series.published };
    const season = await this.seasonModel.findOne({ posterKey: key });
    if (season) {
      const parent = await this.seriesModel.findById(season.seriesId);
      return { published: Boolean(season.published && parent?.published) };
    }
    const episode = await this.episodeModel.findOne({ thumbnailKey: key });
    if (episode) {
      const parent = await this.seriesModel.findById(episode.seriesId);
      return { published: Boolean(episode.published && parent?.published) };
    }
    return null;
  }

  async createCollection(dto: UpsertSeriesCollectionDto): Promise<SeriesCollectionDocument> {
    this.rejectPathFields(dto as unknown as Record<string, unknown>);
    return this.collectionModel.create({
      name: dto.name,
      slug: dto.slug ?? (await this.uniqueCollectionSlug(dto.name)),
      description: dto.description ?? '',
      posterUrl: dto.posterUrl ?? null,
      sortOrder: dto.sortOrder ?? 0,
    });
  }

  async updateCollection(id: string, dto: UpdateSeriesCollectionDto): Promise<SeriesCollectionDocument> {
    this.rejectPathFields(dto as unknown as Record<string, unknown>);
    const collection = await this.collectionModel.findByIdAndUpdate(id, { $set: dto }, { returnDocument: 'after' });
    if (!collection) {
      throw new NotFoundException({ error: ErrorCode.NotFound, message: 'Collection not found.' });
    }
    return collection;
  }

  async removeCollection(id: string): Promise<void> {
    const collection = await this.collectionModel.findByIdAndDelete(id);
    if (!collection) {
      throw new NotFoundException({ error: ErrorCode.NotFound, message: 'Collection not found.' });
    }
    await this.seriesModel.updateMany({ collectionId: collection._id }, { $set: { collectionId: null } });
  }

  async listCollectionsAdmin(): Promise<PublicSeriesCollection[]> {
    const collections = await this.collectionModel.find().sort({ sortOrder: 1, name: 1 });
    const counts = await this.publishedCollectionCounts({});
    return collections.map((collection) =>
      toPublicCollection(collection, counts.get(String(collection._id)) ?? 0),
    );
  }

  private async requireCollection(id: string): Promise<SeriesCollectionDocument> {
    const collection = await this.collectionModel.findById(id);
    if (!collection) {
      throw new NotFoundException({ error: ErrorCode.NotFound, message: 'Collection not found.' });
    }
    return collection;
  }

  private async refreshEpisodeAvailability(episodeId: Types.ObjectId): Promise<void> {
    const episode = await this.episodeModel.findById(episodeId);
    if (!episode || episode.availability === MovieAvailability.ComingSoon) return;
    const videos = await this.assetModel.find({ episodeId, kind: MediaKind.Video }).select('-storagePath');
    let availability: MovieAvailability = MovieAvailability.Unavailable;
    if (videos.some((asset) => asset.status === MediaAssetStatus.Ready)) {
      availability = MovieAvailability.Available;
    } else if (videos.some((asset) => asset.status === MediaAssetStatus.Processing)) {
      availability = MovieAvailability.Processing;
    }
    if (episode.availability !== availability) {
      episode.availability = availability;
      await episode.save();
    }
  }
}

function uniqueSeriesIds(ids: string[]): Types.ObjectId[] {
  const seen = new Set<string>();
  const out: Types.ObjectId[] = [];
  for (const id of ids) {
    if (!id || seen.has(id) || !Types.ObjectId.isValid(id) || id.length !== 24) {
      continue;
    }
    seen.add(id);
    out.push(new Types.ObjectId(id));
  }
  return out;
}
