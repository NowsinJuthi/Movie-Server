import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ErrorCode,
  MediaAssetStatus,
  MediaKind,
  MaturityLevel,
  SEARCH_COMMIT_MIN_CHARS,
  SEARCH_HISTORY_LIMIT,
  SearchKind,
  SearchSort,
  type HomeCard,
  type SearchEpisodeHit,
  type SearchGroupPage,
  type SearchHistoryItem,
  type SearchPersonHit,
  type SearchResponse,
  type SearchSimilarResponse,
  type SearchSuggestResponse,
  type SearchTrendingResponse,
  type SubscriptionEntitlement,
} from '@movie-server/shared';
import { RequestUser } from '../auth/auth.types';
import { MoviesService } from '../movies/movies.service';
import { MyListService } from '../profiles/my-list.service';
import { ProfilesService } from '../profiles/profiles.service';
import { RecommendationsService } from '../profiles/recommendations.service';
import { Movie, MovieDocument } from '../movies/schemas/movie.schema';
import { Series, SeriesDocument } from '../series/schemas/series.schema';
import { Episode, EpisodeDocument } from '../series/schemas/episode.schema';
import { MediaAsset, MediaAssetDocument } from '../movies/schemas/media-asset.schema';
import { SearchHistory, SearchHistoryDocument } from './schemas/search-history.schema';
import { SearchTrend, SearchTrendDocument } from './schemas/search-trend.schema';
import { QuerySearchDto } from './dto/query-search.dto';
import { normalizeSearchText } from '../common/search-fields';
import {
  allowedMaturity,
  collectPeople,
  episodeToHit,
  movieDocsToCards,
  scoreMediaDoc,
  seriesDocsToCards,
  titleSuggestItems,
} from './search.mapper';
import {
  buildIndexedQueryClauses,
  catalogSort,
  containsRegex,
  emptyGroup,
  intersectIds,
  matchingGenres,
  paginateMeta,
  prefixRegex,
  ratingFilter,
  shouldUseTextSearch,
  similarContentScore,
  toTextSearch,
  yearRangeFilter,
  type SearchMongoFilter,
} from './search.util';

const SUGGEST_TITLE_LIMIT = 8;
const PEOPLE_QUERY_LIMIT = 16;
const SIMILAR_CANDIDATE_LIMIT = 80;
const SIMILAR_RESULT_LIMIT = 12;
const RELEVANCE_FETCH_CAP = 240;
const TRENDING_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

type Viewer = { maturity: MaturityLevel; isKids: boolean };

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(Movie.name) private readonly movieModel: Model<MovieDocument>,
    @InjectModel(Series.name) private readonly seriesModel: Model<SeriesDocument>,
    @InjectModel(Episode.name) private readonly episodeModel: Model<EpisodeDocument>,
    @InjectModel(MediaAsset.name) private readonly assetModel: Model<MediaAssetDocument>,
    @InjectModel(SearchHistory.name) private readonly historyModel: Model<SearchHistoryDocument>,
    @InjectModel(SearchTrend.name) private readonly trendModel: Model<SearchTrendDocument>,
    private readonly movies: MoviesService,
    private readonly myList: MyListService,
    private readonly profiles: ProfilesService,
    private readonly recommendations: RecommendationsService,
  ) {}

  async search(
    user: RequestUser,
    query: QuerySearchDto,
    entitlement?: SubscriptionEntitlement | null,
  ): Promise<SearchResponse> {
    const viewer = await this.movies.resolveViewer(user);
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 12, 48);
    const q = query.q?.trim() ?? '';
    const kind = query.kind ?? SearchKind.All;
    const sort = query.sort ?? (q ? SearchSort.Relevance : SearchSort.Popularity);
    const myList = await this.myListIds(user);

    const [movieAssetIds, episodeAssetIds] = await Promise.all([
      this.movieIdsForAssets(query),
      this.episodeIdsForAssets(query),
    ]);

    const includeMovies = kind === SearchKind.All || kind === SearchKind.Movie;
    const includeSeries = kind === SearchKind.All || kind === SearchKind.Series;
    const includeEpisodes = kind === SearchKind.All || kind === SearchKind.Episode;

    const [movies, series, episodes, people] = await Promise.all([
      includeMovies
        ? this.searchMovies(q, query, viewer, sort, page, limit, movieAssetIds, myList, entitlement)
        : emptyGroup<HomeCard>(page, limit),
      includeSeries
        ? this.searchSeries(q, query, viewer, sort, page, limit, episodeAssetIds, myList)
        : emptyGroup<HomeCard>(page, limit),
      includeEpisodes
        ? this.searchEpisodes(q, query, viewer, sort, page, limit, episodeAssetIds)
        : emptyGroup<SearchEpisodeHit>(page, limit),
      q && kind !== SearchKind.Episode
        ? this.searchPeople(q, viewer, query.genre)
        : Promise.resolve([] as SearchPersonHit[]),
    ]);

    const total = movies.total + series.total + episodes.total;
    if (query.commit && q.length >= SEARCH_COMMIT_MIN_CHARS && user.activeProfileId) {
      await this.recordHistory(user.id, user.activeProfileId, q, total);
    }

    const recommendations =
      q && total === 0 ? await this.emptyRecommendations(viewer, entitlement, myList) : [];

    return { q, kind, sort, movies, series, episodes, people, total, recommendations };
  }

  async suggest(user: RequestUser, rawQuery: string): Promise<SearchSuggestResponse> {
    const q = rawQuery.trim();
    const viewer = await this.movies.resolveViewer(user);
    if (!q) {
      return { q, titles: [], people: [], genres: [] };
    }
    const base = this.visibilityFilter(viewer);
    const rx = q.length <= 2 ? containsRegex(q) : prefixRegex(q);
    const titleClause = { $or: [{ titleNormalized: rx }, { originalTitleNormalized: rx }] };
    const [movies, series, moviePeople, seriesPeople] = await Promise.all([
      this.movieModel
        .find({ ...base, ...titleClause })
        .select('title originalTitle posterUrl posterKey')
        .sort({ popular: -1, trending: -1, createdAt: -1 })
        .limit(SUGGEST_TITLE_LIMIT)
        .lean(),
      this.seriesModel
        .find({ ...base, ...titleClause })
        .select('title originalTitle posterUrl posterKey')
        .sort({ popular: -1, trending: -1, createdAt: -1 })
        .limit(SUGGEST_TITLE_LIMIT)
        .lean(),
      this.movieModel
        .find({ ...base, peopleNormalized: rx })
        .select('peopleNormalized cast directors writers')
        .limit(PEOPLE_QUERY_LIMIT)
        .lean(),
      this.seriesModel
        .find({ ...base, peopleNormalized: rx })
        .select('peopleNormalized cast directors')
        .limit(PEOPLE_QUERY_LIMIT)
        .lean(),
    ]);

    const people = new Set<string>();
    for (const doc of [...moviePeople, ...seriesPeople]) {
      for (const name of doc.peopleNormalized ?? []) {
        if (rx.test(name)) {
          people.add(name);
        }
      }
    }

    return {
      q,
      titles: titleSuggestItems(movies as MovieDocument[], series as SeriesDocument[]).slice(0, SUGGEST_TITLE_LIMIT),
      people: [...people].slice(0, 6).map((name) => ({
        kind: 'person' as const,
        label: name.replace(/\b\w/g, (letter) => letter.toUpperCase()),
        query: name,
      })),
      genres: matchingGenres(q).slice(0, 6).map((genre) => ({
        kind: 'genre' as const,
        label: genre === 'scifi' ? 'Sci-Fi' : genre.charAt(0).toUpperCase() + genre.slice(1),
        query: genre,
      })),
    };
  }

  async trending(): Promise<SearchTrendingResponse> {
    const since = new Date(Date.now() - TRENDING_WINDOW_MS);
    const items = await this.trendModel
      .find({ lastSearchedAt: { $gte: since }, count: { $gte: 1 } })
      .sort({ count: -1, lastSearchedAt: -1 })
      .limit(10)
      .lean();
    return { items: items.map((item) => ({ query: item.query, count: item.count })) };
  }

  async history(userId: string, profileId: string): Promise<{ items: SearchHistoryItem[] }> {
    await this.profiles.get(userId, profileId);
    const rows = await this.historyModel
      .find({ userId: new Types.ObjectId(userId), profileId: new Types.ObjectId(profileId) })
      .sort({ createdAt: -1 })
      .limit(SEARCH_HISTORY_LIMIT)
      .lean();
    return {
      items: rows.map((row) => ({
        id: String(row._id),
        query: row.query,
        resultCount: row.resultCount,
        searchedAt: row.createdAt.toISOString(),
      })),
    };
  }

  async clearHistory(userId: string, profileId: string): Promise<{ deleted: number }> {
    await this.profiles.get(userId, profileId);
    const result = await this.historyModel.deleteMany({
      userId: new Types.ObjectId(userId),
      profileId: new Types.ObjectId(profileId),
    });
    return { deleted: result.deletedCount ?? 0 };
  }

  async recordHistory(userId: string, profileId: string, query: string, resultCount = 0): Promise<void> {
    const trimmed = query.trim();
    const normalizedQuery = normalizeSearchText(trimmed);
    if (normalizedQuery.length < SEARCH_COMMIT_MIN_CHARS) {
      return;
    }
    await this.profiles.get(userId, profileId);
    const profileOid = new Types.ObjectId(profileId);
    const userOid = new Types.ObjectId(userId);
    await this.historyModel.findOneAndUpdate(
      { profileId: profileOid, normalizedQuery },
      {
        $set: {
          userId: userOid,
          query: trimmed.slice(0, 120),
          resultCount,
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );
    await this.trendModel.findOneAndUpdate(
      { normalizedQuery },
      {
        $set: { query: trimmed.slice(0, 120), lastSearchedAt: new Date() },
        $inc: { count: 1 },
      },
      { upsert: true },
    );
    const extra = await this.historyModel
      .find({ profileId: profileOid })
      .sort({ createdAt: -1 })
      .skip(SEARCH_HISTORY_LIMIT)
      .select('_id');
    if (extra.length) {
      await this.historyModel.deleteMany({ _id: { $in: extra.map((row) => row._id) } });
    }
  }

  async similarMovie(
    user: RequestUser,
    id: string,
    entitlement?: SubscriptionEntitlement | null,
  ): Promise<SearchSimilarResponse> {
    const viewer = await this.movies.resolveViewer(user);
    const source = await this.movieModel.findById(id);
    if (!source || !source.published || !this.canView(viewer, source.maturityRating)) {
      throw new NotFoundException({ error: ErrorCode.MovieNotFound, message: 'Movie not found.' });
    }
    const myList = await this.myListIds(user);
    const excluded = await this.personalizationExclusions(user);
    const items = await this.similarTitles('movie', source, viewer, myList, entitlement, excluded);
    return { id: String(source._id), kind: 'movie', items };
  }

  async similarSeries(user: RequestUser, id: string): Promise<SearchSimilarResponse> {
    const viewer = await this.movies.resolveViewer(user);
    const source = await this.seriesModel.findById(id);
    if (!source || !source.published || !this.canView(viewer, source.maturityRating)) {
      throw new NotFoundException({ error: ErrorCode.SeriesNotFound, message: 'Series not found.' });
    }
    const myList = await this.myListIds(user);
    const excluded = await this.personalizationExclusions(user);
    const items = await this.similarTitles('series', source, viewer, myList, undefined, excluded);
    return { id: String(source._id), kind: 'series', items };
  }

  private async similarTitles(
    kind: 'movie' | 'series',
    source: MovieDocument | SeriesDocument,
    viewer: Viewer,
    myList: Set<string>,
    entitlement?: SubscriptionEntitlement | null,
    excluded: Set<string> = new Set(),
  ): Promise<HomeCard[]> {
    const sourceCast = (source.cast ?? []).map((member) => normalizeSearchText(member.name));
    const sourceDirectors = (source.directors ?? []).map((name) => normalizeSearchText(name));
    const base = {
      ...this.visibilityFilter(viewer),
      _id: { $ne: source._id },
      ...(source.genres.length ? { genres: { $in: source.genres } } : {}),
    };
    const scoreOf = (doc: MovieDocument | SeriesDocument) =>
      similarContentScore({
        sourceGenres: source.genres,
        sourceCast,
        sourceDirectors,
        candidateGenres: doc.genres ?? [],
        candidateCast: (doc.cast ?? []).map((member) => normalizeSearchText(member.name)),
        candidateDirectors: (doc.directors ?? []).map((name) => normalizeSearchText(name)),
        popular: doc.popular,
        trending: doc.trending,
        imdb: doc.ratings?.imdb ?? null,
      });

    if (kind === 'movie') {
      const movies = await this.movieModel.find(base).limit(SIMILAR_CANDIDATE_LIMIT);
      const ranked = movies
        .filter((item) => !excluded.has(String(item._id)))
        .sort((a, b) => scoreOf(b) - scoreOf(a))
        .slice(0, SIMILAR_RESULT_LIMIT);
      const assets = await this.assetsByMovie(ranked.map((item) => item._id));
      return movieDocsToCards(ranked, assets, myList, entitlement);
    }
    const series = await this.seriesModel.find(base).limit(SIMILAR_CANDIDATE_LIMIT);
    const ranked = series
      .filter((item) => !excluded.has(String(item._id)))
      .sort((a, b) => scoreOf(b) - scoreOf(a))
      .slice(0, SIMILAR_RESULT_LIMIT);
    return seriesDocsToCards(ranked, myList);
  }

  private async searchMovies(
    q: string,
    query: QuerySearchDto,
    viewer: Viewer,
    sort: SearchSort,
    page: number,
    limit: number,
    assetIds: Types.ObjectId[] | null,
    myList: Set<string>,
    entitlement?: SubscriptionEntitlement | null,
  ): Promise<SearchGroupPage<HomeCard>> {
    if (assetIds && assetIds.length === 0) {
      return emptyGroup(page, limit);
    }
    const filter = this.movieFilter(q, query, viewer, assetIds);
    const { docs, total } = await this.pagedMedia(this.movieModel, filter, q, sort, 'releaseYear', page, limit);
    const assets = await this.assetsByMovie(docs.map((doc) => doc._id));
    return {
      items: movieDocsToCards(docs, assets, myList, entitlement),
      ...paginateMeta(total, page, limit),
    };
  }

  private async searchSeries(
    q: string,
    query: QuerySearchDto,
    viewer: Viewer,
    sort: SearchSort,
    page: number,
    limit: number,
    episodeAssetIds: Types.ObjectId[] | null,
    myList: Set<string>,
  ): Promise<SearchGroupPage<HomeCard>> {
    let seriesIdsFromAssets: Types.ObjectId[] | null = null;
    if (episodeAssetIds) {
      if (episodeAssetIds.length === 0) {
        return emptyGroup(page, limit);
      }
      const episodes = await this.episodeModel.find({ _id: { $in: episodeAssetIds } }).select('seriesId').lean();
      seriesIdsFromAssets = [...new Set(episodes.map((item) => String(item.seriesId)))].map(
        (id) => new Types.ObjectId(id),
      );
      if (seriesIdsFromAssets.length === 0) {
        return emptyGroup(page, limit);
      }
    }
    const filter = this.seriesFilter(q, query, viewer, seriesIdsFromAssets);
    const { docs, total } = await this.pagedMedia(this.seriesModel, filter, q, sort, 'firstAirYear', page, limit);
    return {
      items: seriesDocsToCards(docs, myList),
      ...paginateMeta(total, page, limit),
    };
  }

  private async searchEpisodes(
    q: string,
    query: QuerySearchDto,
    viewer: Viewer,
    sort: SearchSort,
    page: number,
    limit: number,
    episodeAssetIds: Types.ObjectId[] | null,
  ): Promise<SearchGroupPage<SearchEpisodeHit>> {
    if (episodeAssetIds && episodeAssetIds.length === 0) {
      return emptyGroup(page, limit);
    }
    const seriesFilter = this.seriesFilter('', { ...query, tag: undefined }, viewer, null);
    const series = await this.seriesModel.find(seriesFilter).select('_id title firstAirYear posterUrl posterKey published').lean();
    const seriesIds = series.map((item) => item._id);
    if (seriesIds.length === 0) {
      return emptyGroup(page, limit);
    }
    const seriesMap = new Map(series.map((item) => [String(item._id), item as SeriesDocument]));
    const filter: SearchMongoFilter = {
      published: true,
      seriesId: { $in: seriesIds },
    };
    if (episodeAssetIds) {
      filter._id = { $in: episodeAssetIds };
    }
    if (q) {
      const rx = prefixRegex(q);
      const clauses: SearchMongoFilter[] = [{ titleNormalized: rx }];
      if (shouldUseTextSearch(q)) {
        // text is queried separately below
      }
      filter.$or = clauses;
    }
    const skip = (page - 1) * limit;
    const episodeSort: Record<string, 1 | -1> =
      sort === SearchSort.Newest ? { airDate: -1, createdAt: -1 } : { seasonNumber: 1, episodeNumber: 1 };
    let docs = await this.episodeModel.find(filter).sort(episodeSort).skip(skip).limit(limit);
    let total = await this.episodeModel.countDocuments(filter);
    if (q && docs.length === 0 && shouldUseTextSearch(q)) {
      const textFilter: SearchMongoFilter = {
        published: true,
        seriesId: { $in: seriesIds },
        ...(episodeAssetIds ? { _id: { $in: episodeAssetIds } } : {}),
        $text: { $search: toTextSearch(q) },
      };
      try {
        docs = await this.episodeModel
          .find(textFilter, { score: { $meta: 'textScore' } })
          .sort({ score: { $meta: 'textScore' } })
          .skip(skip)
          .limit(limit);
        total = await this.episodeModel.countDocuments(textFilter);
      } catch {
        docs = [];
      }
    }
    const items = docs
      .map((episode) => {
        const show = seriesMap.get(String(episode.seriesId));
        if (!show) return null;
        return episodeToHit(episode, show, q ? scoreMediaDoc({ titleNormalized: episode.titleNormalized }, q) : 0);
      })
      .filter((item): item is SearchEpisodeHit => Boolean(item));
    return { items, ...paginateMeta(total, page, limit) };
  }

  private async searchPeople(q: string, viewer: Viewer, genre?: string): Promise<SearchPersonHit[]> {
    const base = { ...this.visibilityFilter(viewer), peopleNormalized: prefixRegex(q), ...(genre ? { genres: genre } : {}) };
    const [movies, series] = await Promise.all([
      this.movieModel.find(base).limit(PEOPLE_QUERY_LIMIT),
      this.seriesModel.find(base).limit(PEOPLE_QUERY_LIMIT),
    ]);
    return collectPeople(q, movies, series);
  }

  private async pagedMedia(
    model: Model<MovieDocument>,
    filter: SearchMongoFilter,
    q: string,
    sort: SearchSort,
    yearField: 'releaseYear' | 'firstAirYear',
    page: number,
    limit: number,
  ): Promise<{ docs: MovieDocument[]; total: number }>;
  private async pagedMedia(
    model: Model<SeriesDocument>,
    filter: SearchMongoFilter,
    q: string,
    sort: SearchSort,
    yearField: 'releaseYear' | 'firstAirYear',
    page: number,
    limit: number,
  ): Promise<{ docs: SeriesDocument[]; total: number }>;
  private async pagedMedia(
    model: Model<MovieDocument> | Model<SeriesDocument>,
    filter: SearchMongoFilter,
    q: string,
    sort: SearchSort,
    yearField: 'releaseYear' | 'firstAirYear',
    page: number,
    limit: number,
  ): Promise<{ docs: Array<MovieDocument | SeriesDocument>; total: number }> {
    const catalog = model as Model<MovieDocument>;
    const skip = (page - 1) * limit;
    const typedFilter = filter as object;
    if (q && sort === SearchSort.Relevance) {
      const fetchLimit = Math.min(RELEVANCE_FETCH_CAP, skip + limit * 3);
      const docs = await catalog.find(typedFilter).limit(fetchLimit);
      const scored = new Map<string, { doc: MovieDocument | SeriesDocument; score: number }>();
      for (const doc of docs) {
        scored.set(String(doc._id), { doc, score: scoreMediaDoc(doc, q) });
      }
      if (shouldUseTextSearch(q)) {
        const textFilter = this.textFilter(filter, q);
        try {
          const textDocs = await catalog
            .find(textFilter as object, { score: { $meta: 'textScore' } })
            .sort({ score: { $meta: 'textScore' } })
            .limit(limit * 2);
          for (const doc of textDocs as Array<(MovieDocument | SeriesDocument) & { score?: number }>) {
            const id = String(doc._id);
            const textScore = typeof doc.score === 'number' ? doc.score : 1;
            const next = scoreMediaDoc(doc, q, textScore);
            const prev = scored.get(id);
            if (!prev || next > prev.score) {
              scored.set(id, { doc, score: next });
            }
          }
        } catch {
          // Text index may be building; prefix/equality clauses remain indexed.
        }
      }
      const ranked = [...scored.values()].sort((a, b) => b.score - a.score || b.doc.createdAt.getTime() - a.doc.createdAt.getTime());
      const total = Math.max(await catalog.countDocuments(typedFilter), ranked.length);
      return { docs: ranked.slice(skip, skip + limit).map((item) => item.doc), total };
    }

    let docs: Array<MovieDocument | SeriesDocument> = await catalog
      .find(typedFilter)
      .sort(catalogSort(sort, yearField))
      .skip(skip)
      .limit(limit);
    let total = await catalog.countDocuments(typedFilter);
    if (q && docs.length === 0 && shouldUseTextSearch(q)) {
      const textFilter = this.textFilter(filter, q);
      try {
        docs = await catalog
          .find(textFilter as object, { score: { $meta: 'textScore' } })
          .sort({ score: { $meta: 'textScore' } })
          .skip(skip)
          .limit(limit);
        total = await catalog.countDocuments(textFilter as object);
      } catch {
        docs = [];
      }
    }
    return { docs, total };
  }

  private textFilter(filter: SearchMongoFilter, q: string): SearchMongoFilter {
    const { $or, $and, ...rest } = filter;
    void $or;
    const extras = Array.isArray($and) ? $and.filter((clause) => !('$or' in (clause as object))) : [];
    return {
      ...rest,
      $text: { $search: toTextSearch(q) },
      ...(extras.length ? { $and: extras } : {}),
    };
  }

  private movieFilter(
    q: string,
    query: QuerySearchDto,
    viewer: Viewer,
    assetIds: Types.ObjectId[] | null,
  ): SearchMongoFilter {
    return this.catalogFilter(q, query, viewer, 'releaseYear', assetIds);
  }

  private seriesFilter(
    q: string,
    query: QuerySearchDto,
    viewer: Viewer,
    seriesIds: Types.ObjectId[] | null,
  ): SearchMongoFilter {
    return this.catalogFilter(q, query, viewer, 'firstAirYear', seriesIds);
  }

  private catalogFilter(
    q: string,
    query: QuerySearchDto,
    viewer: Viewer,
    yearField: 'releaseYear' | 'firstAirYear',
    ids: Types.ObjectId[] | null,
  ): SearchMongoFilter {
    const filter: SearchMongoFilter = { ...this.visibilityFilter(viewer) };
    if (query.genre) {
      filter.genres = query.genre;
    }
    if (query.tag) {
      filter.tags = query.tag;
    }
    const year = yearRangeFilter(yearField, query.year, query.yearFrom, query.yearTo);
    if (year) {
      Object.assign(filter, year);
    }
    const rating = ratingFilter(query.minRating);
    if (rating) {
      filter.$and = [...((filter.$and as SearchMongoFilter[]) ?? []), rating];
    }
    if (ids) {
      filter._id = { $in: ids };
    }
    if (q) {
      const clauses = buildIndexedQueryClauses(q);
      filter.$and = [...((filter.$and as SearchMongoFilter[]) ?? []), { $or: clauses }];
    }
    return filter;
  }

  private visibilityFilter(viewer: Viewer): SearchMongoFilter {
    return {
      published: true,
      maturityRating: { $in: allowedMaturity(viewer.maturity, viewer.isKids) },
    };
  }

  private canView(viewer: Viewer, rating: MaturityLevel): boolean {
    return allowedMaturity(viewer.maturity, viewer.isKids).includes(rating);
  }

  private async movieIdsForAssets(query: QuerySearchDto): Promise<Types.ObjectId[] | null> {
    return this.idsForAssets('movieId', query);
  }

  private async episodeIdsForAssets(query: QuerySearchDto): Promise<Types.ObjectId[] | null> {
    return this.idsForAssets('episodeId', query);
  }

  private async idsForAssets(
    field: 'movieId' | 'episodeId',
    query: QuerySearchDto,
  ): Promise<Types.ObjectId[] | null> {
    const sets: string[][] = [];
    if (query.quality) {
      sets.push(await this.distinctAssetParents(field, { kind: MediaKind.Video, quality: query.quality }));
    }
    if (query.audio) {
      sets.push(await this.distinctAssetParents(field, { kind: MediaKind.Audio, language: query.audio }));
    }
    if (query.language) {
      sets.push(await this.distinctAssetParents(field, { language: query.language }));
    }
    if (sets.length === 0) {
      return null;
    }
    return intersectIds(sets).map((id) => new Types.ObjectId(id));
  }

  private async distinctAssetParents(
    field: 'movieId' | 'episodeId',
    extra: SearchMongoFilter,
  ): Promise<string[]> {
    const ids = await this.assetModel.distinct(field, {
      status: MediaAssetStatus.Ready,
      [field]: { $ne: null },
      ...extra,
    });
    return ids.filter(Boolean).map((id) => String(id));
  }

  private async assetsByMovie(ids: Types.ObjectId[]): Promise<Map<string, MediaAssetDocument[]>> {
    const map = new Map<string, MediaAssetDocument[]>();
    if (ids.length === 0) {
      return map;
    }
    const assets = await this.assetModel
      .find({ movieId: { $in: ids } })
      .select('-storagePath')
      .sort({ sortOrder: 1, createdAt: 1 });
    for (const asset of assets) {
      const key = String(asset.movieId);
      const list = map.get(key) ?? [];
      list.push(asset);
      map.set(key, list);
    }
    return map;
  }

  private async personalizationExclusions(user: RequestUser): Promise<Set<string>> {
    if (!user.activeProfileId) {
      return new Set();
    }
    const [completed, disliked] = await Promise.all([
      this.recommendations.completedIds(user.id, user.activeProfileId),
      this.recommendations.dislikedIds(user.id, user.activeProfileId),
    ]);
    return new Set([...completed, ...disliked]);
  }

  private async myListIds(user: RequestUser): Promise<Set<string>> {
    if (!user.activeProfileId) {
      return new Set();
    }
    try {
      const items = await this.myList.list(user.id, user.activeProfileId);
      return new Set(items.map((item) => item.mediaId));
    } catch {
      return new Set();
    }
  }

  private async emptyRecommendations(
    viewer: Viewer,
    entitlement: SubscriptionEntitlement | null | undefined,
    myList: Set<string>,
  ): Promise<HomeCard[]> {
    const base = this.visibilityFilter(viewer);
    const [movies, series] = await Promise.all([
      this.movieModel.find(base).sort({ popular: -1, trending: -1, createdAt: -1 }).limit(8),
      this.seriesModel.find(base).sort({ popular: -1, trending: -1, createdAt: -1 }).limit(8),
    ]);
    const assets = await this.assetsByMovie(movies.map((item) => item._id));
    return [...movieDocsToCards(movies, assets, myList, entitlement), ...seriesDocsToCards(series, myList)].slice(0, 12);
  }
}
