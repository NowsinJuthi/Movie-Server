import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  BulkMovieAction,
  ErrorCode,
  MATURITY_RANK,
  MediaAssetStatus,
  MediaKind,
  MovieAvailability,
  MovieSort,
  MaturityLevel,
  profileCanViewMaturity,
  type AdminMovieDetailResponse,
  type MovieCatalogResponse,
  type MovieContinueItem,
  type MovieDetailResponse,
  type MovieListResponse,
  type MoviePlaybackResponse,
  type MovieProgressResponse,
  type PublicMovie,
  type PublicMovieCollection,
  type SubscriptionEntitlement,
  type VideoQuality,
  type WatchProgress,
} from '@movie-server/shared';
import { RequestUser } from '../auth/auth.types';
import { ProfilesService } from '../profiles/profiles.service';
import { Movie, MovieDocument } from './schemas/movie.schema';
import { MediaAsset, MediaAssetDocument } from './schemas/media-asset.schema';
import { MovieCollection, MovieCollectionDocument } from './schemas/movie-collection.schema';
import { QueryMoviesDto } from './dto/query-movies.dto';
import { UpdateMovieDto, UpsertMovieDto } from './dto/upsert-movie.dto';
import { CreateMediaAssetDto, UpdateMediaAssetDto } from './dto/media-asset.dto';
import { ArtworkStorageService } from './artwork-storage.service';
import { sniffImageMime } from '../common/security/image-bytes';
import { CollectionsService } from './collections.service';
import {
  toAdminMediaAsset,
  toPublicCollection,
  toPublicMediaAsset,
  toPublicMovie,
} from './movie.mapper';
import { escapeRegex, looksLikeFilesystemPath, newStorageKey, slugify } from './movie.util';
import { buildMediaSearchFields } from '../common/search-fields';
import { StreamService } from '../stream/stream.service';
import { foldMarkerFields, toPlaybackMarkers } from '../stream/playback-markers.util';
import { WatchHistoryService } from '../profiles/watch-history.service';
import { SubscriptionAccessService } from '../subscriptions/subscription-access.service';
import { LibraryExclusionService } from '../library/library-exclusion.service';
import { TmdbMetadataService } from '../library/metadata/tmdb-metadata.service';

const SHELF_LIMIT = 12;
type MovieFilter = Record<string, unknown>;

@Injectable()
export class MoviesService {
  constructor(
    @InjectModel(Movie.name) private readonly movieModel: Model<MovieDocument>,
    @InjectModel(MediaAsset.name) private readonly assetModel: Model<MediaAssetDocument>,
    @InjectModel(MovieCollection.name)
    private readonly collectionModel: Model<MovieCollectionDocument>,
    private readonly profiles: ProfilesService,
    private readonly collections: CollectionsService,
    private readonly artwork: ArtworkStorageService,
    private readonly streams: StreamService,
    private readonly history: WatchHistoryService,
    private readonly access: SubscriptionAccessService,
    private readonly libraryExclusions: LibraryExclusionService,
    private readonly tmdb: TmdbMetadataService,
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

  private maturityFilter(maturity: MaturityLevel, isKids: boolean): MovieFilter {
    const cap = isKids ? MaturityLevel.Kids : maturity;
    const allowed = (Object.keys(MATURITY_RANK) as MaturityLevel[]).filter(
      (level) => MATURITY_RANK[level] <= MATURITY_RANK[cap],
    );
    return { maturityRating: { $in: allowed } };
  }

  private async uniqueMovieSlug(title: string, excludeId?: string): Promise<string> {
    const base = slugify(title);
    let slug = base;
    let n = 2;
    for (;;) {
      const existing = await this.movieModel.findOne({
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

  private buildFilter(
    query: QueryMoviesDto,
    options: { admin: boolean; maturity?: MaturityLevel; isKids?: boolean },
  ): MovieFilter {
    const filter: MovieFilter = {};
    if (!options.admin) {
      filter.published = true;
      Object.assign(filter, this.maturityFilter(options.maturity ?? MaturityLevel.Mature, Boolean(options.isKids)));
    } else if (query.published !== undefined) {
      filter.published = query.published;
    }
    if (query.genre) {
      filter.genres = query.genre;
    }
    if (query.tag) {
      filter.tags = query.tag;
    }
    if (query.year) {
      filter.releaseYear = query.year;
    }
    if (query.collection) {
      filter.collectionId = new Types.ObjectId(query.collection);
    }
    if (query.featured !== undefined) {
      filter.featured = query.featured;
    }
    if (query.trending !== undefined) {
      filter.trending = query.trending;
    }
    if (query.popular !== undefined) {
      filter.popular = query.popular;
    }
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
        { writers: rx },
        { 'cast.name': rx },
      ];
    }
    return filter;
  }

  private sortSpec(sort?: MovieSort): Record<string, 1 | -1> {
    switch (sort) {
      case MovieSort.Title:
        return { title: 1 };
      case MovieSort.Year:
        return { releaseYear: -1, title: 1 };
      case MovieSort.Runtime:
        return { runtimeMinutes: -1 };
      case MovieSort.Featured:
        return { featured: -1, trending: -1, popular: -1, createdAt: -1 };
      default:
        return { createdAt: -1 };
    }
  }

  private async assetsByMovie(ids: Types.ObjectId[]): Promise<Map<string, MediaAssetDocument[]>> {
    if (ids.length === 0) {
      return new Map();
    }
    const assets = await this.assetModel
      .find({ movieId: { $in: ids } })
      .select('-storagePath')
      .sort({ sortOrder: 1, createdAt: 1 });
    const map = new Map<string, MediaAssetDocument[]>();
    for (const asset of assets) {
      const key = String(asset.movieId);
      const list = map.get(key) ?? [];
      list.push(asset);
      map.set(key, list);
    }
    return map;
  }

  private mapMovies(
    movies: MovieDocument[],
    assets: Map<string, MediaAssetDocument[]>,
    entitlement?: SubscriptionEntitlement | null,
    admin = false,
  ): PublicMovie[] {
    return movies.map((movie) =>
      toPublicMovie(movie, {
        entitlement,
        assets: assets.get(String(movie._id)) ?? [],
        admin,
      }),
    );
  }

  async list(
    query: QueryMoviesDto,
    options: {
      admin: boolean;
      maturity?: MaturityLevel;
      isKids?: boolean;
      entitlement?: SubscriptionEntitlement | null;
    },
  ): Promise<MovieListResponse> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 50);
    const filter = this.buildFilter(query, options);
    const [total, movies] = await Promise.all([
      this.movieModel.countDocuments(filter),
      this.movieModel
        .find(filter)
        .sort(this.sortSpec(query.sort))
        .skip((page - 1) * limit)
        .limit(limit),
    ]);
    const assets = await this.assetsByMovie(movies.map((movie) => movie._id));
    return {
      items: this.mapMovies(movies, assets, options.entitlement, options.admin),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async catalog(
    viewer: { maturity: MaturityLevel; isKids: boolean },
    entitlement?: SubscriptionEntitlement | null,
  ): Promise<MovieCatalogResponse> {
    const base: MovieFilter = {
      published: true,
      ...this.maturityFilter(viewer.maturity, viewer.isKids),
    };
    const [featured, trending, popular, newest, collectionDocs] = await Promise.all([
      this.movieModel.find({ ...base, featured: true }).sort({ createdAt: -1 }).limit(SHELF_LIMIT),
      this.movieModel.find({ ...base, trending: true }).sort({ createdAt: -1 }).limit(SHELF_LIMIT),
      this.movieModel.find({ ...base, popular: true }).sort({ createdAt: -1 }).limit(SHELF_LIMIT),
      this.movieModel.find(base).sort({ createdAt: -1 }).limit(SHELF_LIMIT),
      this.collectionModel.find().sort({ sortOrder: 1, name: 1 }).limit(8),
    ]);
    const collectionMovies = await Promise.all(
      collectionDocs.map(async (collection) => {
        const movies = await this.movieModel
          .find({ ...base, collectionId: collection._id })
          .sort({ releaseYear: -1 })
          .limit(SHELF_LIMIT);
        return { collection, movies };
      }),
    );
    const visibleCollections = collectionMovies.filter((row) => row.movies.length > 0);
    const allMovies = [
      ...featured,
      ...trending,
      ...popular,
      ...newest,
      ...visibleCollections.flatMap((row) => row.movies),
    ];
    const assets = await this.assetsByMovie(allMovies.map((movie) => movie._id));
    const map = (movies: MovieDocument[]) => this.mapMovies(movies, assets, entitlement);
    const collections = visibleCollections.map((row) => ({
      collection: toPublicCollection(row.collection, row.movies.length),
      movies: map(row.movies),
    }));
    return {
      featured: map(featured),
      trending: map(trending),
      popular: map(popular),
      newest: map(newest),
      shelves: [
        { id: 'featured', title: 'Featured', items: map(featured) },
        { id: 'trending', title: 'Trending Now', items: map(trending) },
        { id: 'popular', title: 'Popular', items: map(popular) },
        { id: 'newest', title: 'New Arrivals', items: map(newest) },
        ...collections.map((row) => ({
          id: row.collection.id,
          title: row.collection.name,
          items: row.movies,
        })),
      ].filter((shelf) => shelf.items.length > 0),
      collections,
    };
  }

  async publicByIds(
    ids: string[],
    viewer: { maturity: MaturityLevel; isKids: boolean },
    entitlement?: SubscriptionEntitlement | null,
  ): Promise<PublicMovie[]> {
    const objectIds = uniqueObjectIds(ids);
    if (objectIds.length === 0) {
      return [];
    }
    const movies = await this.movieModel.find({
      _id: { $in: objectIds },
      published: true,
      ...this.maturityFilter(viewer.maturity, viewer.isKids),
    });
    const assets = await this.assetsByMovie(movies.map((movie) => movie._id));
    const mapped = this.mapMovies(movies, assets, entitlement);
    const byId = new Map(mapped.map((movie) => [movie.id, movie]));
    return ids.map((id) => byId.get(id)).filter((movie): movie is PublicMovie => Boolean(movie));
  }

  async findByIdOrSlug(idOrSlug: string): Promise<MovieDocument | null> {
    if (Types.ObjectId.isValid(idOrSlug) && idOrSlug.length === 24) {
      const byId = await this.movieModel.findById(idOrSlug);
      if (byId) {
        return byId;
      }
    }
    return this.movieModel.findOne({ slug: idOrSlug.toLowerCase() });
  }

  private notFound(): never {
    throw new NotFoundException({
      error: ErrorCode.MovieNotFound,
      message: 'Movie not found.',
    });
  }

  async getForUser(
    idOrSlug: string,
    user: RequestUser,
    viewer: { maturity: MaturityLevel; isKids: boolean },
    entitlement?: SubscriptionEntitlement | null,
  ): Promise<MovieDetailResponse> {
    const movie = await this.findByIdOrSlug(idOrSlug);
    if (!movie || !movie.published || !profileCanViewMaturity(viewer.maturity, movie.maturityRating, viewer.isKids)) {
      this.notFound();
    }
    const progress =
      user.activeProfileId ? await this.history.get(user.id, user.activeProfileId, String(movie._id)) : null;
    return this.toDetail(movie, entitlement, false, progress);
  }

  async getForAdmin(idOrSlug: string): Promise<AdminMovieDetailResponse> {
    const movie = await this.findByIdOrSlug(idOrSlug);
    if (!movie) {
      this.notFound();
    }
    return this.toDetail(movie, null, true);
  }

  private async toDetail(
    movie: MovieDocument,
    entitlement: SubscriptionEntitlement | null | undefined,
    admin: true,
    progress?: WatchProgress | null,
  ): Promise<AdminMovieDetailResponse>;
  private async toDetail(
    movie: MovieDocument,
    entitlement: SubscriptionEntitlement | null | undefined,
    admin: false,
    progress?: WatchProgress | null,
  ): Promise<MovieDetailResponse>;
  private async toDetail(
    movie: MovieDocument,
    entitlement: SubscriptionEntitlement | null | undefined,
    admin: boolean,
    progress?: WatchProgress | null,
  ): Promise<MovieDetailResponse | AdminMovieDetailResponse> {
    const assets = await this.assetModel
      .find({ movieId: movie._id })
      .select('-storagePath')
      .sort({ sortOrder: 1, createdAt: 1 });
    let collection: PublicMovieCollection | null = null;
    if (movie.collectionId) {
      const doc = await this.collectionModel.findById(movie.collectionId);
      if (doc) {
        const count = await this.movieModel.countDocuments({
          collectionId: doc._id,
          ...(admin ? {} : { published: true }),
        });
        collection = toPublicCollection(doc, count);
      }
    }
    const publicAssets = assets.map((asset) => toPublicMediaAsset(asset, entitlement, admin));
    return {
      movie: toPublicMovie(movie, { entitlement, assets, admin, progress }),
      collection,
      versions: publicAssets.filter((asset) => asset.kind === MediaKind.Video),
      audioTracks: publicAssets.filter((asset) => asset.kind === MediaKind.Audio),
      subtitleTracks: publicAssets.filter((asset) => asset.kind === MediaKind.Subtitle),
      ...(admin ? { assets: assets.map(toAdminMediaAsset) } : {}),
    };
  }

  async listPublicCollections(viewer: {
    maturity: MaturityLevel;
    isKids: boolean;
  }): Promise<PublicMovieCollection[]> {
    const collections = await this.collections.listAll();
    const counts = await this.collections.publishedCounts({
      published: true,
      ...this.maturityFilter(viewer.maturity, viewer.isKids),
    });
    return (await this.collections.toPublicList(collections, counts)).filter((item) => item.movieCount > 0);
  }

  async getPublicCollection(
    idOrSlug: string,
    viewer: { maturity: MaturityLevel; isKids: boolean },
    entitlement?: SubscriptionEntitlement | null,
  ) {
    const collection = await this.collections.get(idOrSlug);
    const movies = await this.movieModel
      .find({
        published: true,
        collectionId: collection._id,
        ...this.maturityFilter(viewer.maturity, viewer.isKids),
      })
      .sort({ releaseYear: -1, title: 1 });
    if (movies.length === 0) {
      throw new NotFoundException({
        error: ErrorCode.NotFound,
        message: 'Collection not found.',
      });
    }
    const assets = await this.assetsByMovie(movies.map((movie) => movie._id));
    return {
      collection: toPublicCollection(collection, movies.length),
      movies: this.mapMovies(movies, assets, entitlement),
    };
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

  async create(dto: UpsertMovieDto): Promise<MovieDocument> {
    this.rejectPathFields(dto as unknown as Record<string, unknown>);
    if (dto.collectionId) {
      await this.collections.get(dto.collectionId);
    }
    const published = Boolean(dto.published);
    return this.movieModel.create({
      slug: dto.slug ?? (await this.uniqueMovieSlug(dto.title)),
      title: dto.title,
      originalTitle: dto.originalTitle ?? null,
      description: dto.description,
      posterUrl: dto.posterUrl ?? null,
      backdropUrl: dto.backdropUrl ?? null,
      trailerUrl: dto.trailerUrl ?? null,
      releaseYear: dto.releaseYear,
      runtimeMinutes: dto.runtimeMinutes,
      genres: dto.genres,
      tags: (dto.tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean),
      cast: (dto.cast ?? []).map((member, index) => ({
        name: member.name,
        character: member.character ?? null,
        order: member.order ?? index,
        imageUrl: member.imageUrl ?? null,
      })),
      directors: dto.directors ?? [],
      writers: dto.writers ?? [],
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
    });
  }

  async update(id: string, dto: UpdateMovieDto): Promise<MovieDocument> {
    this.rejectPathFields(dto as unknown as Record<string, unknown>);
    const movie = await this.movieModel.findById(id);
    if (!movie) {
      this.notFound();
    }
    if (dto.collectionId) {
      await this.collections.get(dto.collectionId);
    }
    if (dto.slug && dto.slug !== movie.slug) {
      const clash = await this.movieModel.findOne({ slug: dto.slug, _id: { $ne: movie._id } });
      if (clash) {
        throw new BadRequestException({
          error: ErrorCode.Conflict,
          message: 'That slug is already in use.',
        });
      }
    }
    const $set: Record<string, unknown> = foldMarkerFields({ ...dto });
    if (dto.collectionId === null) {
      $set.collectionId = null;
    } else if (dto.collectionId) {
      $set.collectionId = new Types.ObjectId(dto.collectionId);
    }
    if (dto.tags) {
      $set.tags = dto.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean);
    }
    if (dto.published === true && !movie.published) {
      $set.publishedAt = new Date();
    }
    if (dto.published === false) {
      $set.publishedAt = null;
    }
    if (dto.posterUrl !== undefined) {
      $set.posterKey = null;
    }
    if (dto.backdropUrl !== undefined) {
      $set.backdropKey = null;
    }
    Object.assign(
      $set,
      buildMediaSearchFields({
        title: typeof $set.title === 'string' ? $set.title : movie.title,
        originalTitle:
          $set.originalTitle !== undefined ? ($set.originalTitle as string | null) : movie.originalTitle,
        cast: ($set.cast as Movie['cast'] | undefined) ?? movie.cast,
        directors: ($set.directors as string[] | undefined) ?? movie.directors,
        writers: ($set.writers as string[] | undefined) ?? movie.writers,
      }),
    );
    const updated = await this.movieModel.findByIdAndUpdate(id, { $set }, { returnDocument: 'after' });
    if (!updated) {
      this.notFound();
    }
    if (movie.published && !updated.published) {
      await this.streams.revokeMedia([id]);
    }
    return updated;
  }

  async applyFromTmdb(
    id: string,
    tmdbId: number,
    options: { updateArtwork?: boolean } = {},
  ): Promise<MovieDocument> {
    if (!this.tmdb.enabled()) {
      throw new BadRequestException({
        error: ErrorCode.ValidationFailed,
        message: 'TMDB_API_KEY is not configured on the server.',
      });
    }
    const movie = await this.movieModel.findById(id);
    if (!movie) {
      this.notFound();
    }
    const meta = await this.tmdb.getMovieById(tmdbId);
    if (!meta) {
      throw new NotFoundException({
        error: ErrorCode.NotFound,
        message: `No TMDB movie found for id ${tmdbId}.`,
      });
    }

    const dto: UpdateMovieDto = {
      title: meta.title,
      originalTitle: meta.originalTitle ?? null,
      description: meta.overview?.slice(0, 4000) || movie.description,
      releaseYear: meta.year ?? movie.releaseYear,
      runtimeMinutes: meta.runtimeMinutes ?? movie.runtimeMinutes,
      genres: (meta.genres.length ? meta.genres : movie.genres).slice(0, 12),
      cast: meta.cast.slice(0, 40).map((member, index) => ({
        name: member.name,
        character: member.character ?? null,
        order: member.order ?? index,
        imageUrl: member.imageUrl ?? null,
      })),
      directors: meta.directors.slice(0, 12),
      writers: meta.writers.slice(0, 12),
      ratings: {
        imdb: movie.ratings?.imdb ?? null,
        critics: movie.ratings?.critics ?? null,
        audience: movie.ratings?.audience ?? null,
        tmdb:
          meta.tmdbRating != null
            ? Math.min(10, Math.max(0, meta.tmdbRating))
            : (movie.ratings?.tmdb ?? null),
      },
    };

    const updated = await this.update(id, dto);

    if (options.updateArtwork !== false) {
      const [poster, backdrop] = await Promise.all([
        this.tmdb.downloadPoster(meta.posterPath),
        this.tmdb.downloadBackdrop(meta.backdropPath),
      ]);
      if (poster) {
        await this.attachArtwork(id, 'poster', {
          mimetype: poster.mimetype,
          buffer: poster.buffer,
          size: poster.buffer.length,
        });
      }
      if (backdrop) {
        await this.attachArtwork(id, 'backdrop', {
          mimetype: backdrop.mimetype,
          buffer: backdrop.buffer,
          size: backdrop.buffer.length,
        });
      }
      const refreshed = await this.movieModel.findById(id);
      return refreshed ?? updated;
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.streams.revokeMedia([id]);
    const movie = await this.movieModel.findById(id);
    if (!movie) {
      this.notFound();
    }
    await this.libraryExclusions.ignoreMovieLinks([
      { id: movie._id, title: movie.title, releaseYear: movie.releaseYear },
    ]);
    await this.movieModel.findByIdAndDelete(id);
    await this.assetModel.deleteMany({ movieId: movie._id });
    await this.artwork.remove(movie.posterKey);
    await this.artwork.remove(movie.backdropKey);
  }

  async bulk(ids: string[], action: BulkMovieAction): Promise<{ matched: number }> {
    const objectIds = ids.map((id) => new Types.ObjectId(id));
    const filter = { _id: { $in: objectIds } };
    if (action === BulkMovieAction.Delete) {
      const movies = await this.movieModel.find(filter);
      await this.streams.revokeMedia(movies.map((item) => String(item._id)));
      await this.libraryExclusions.ignoreMovieLinks(
        movies.map((movie) => ({
          id: movie._id,
          title: movie.title,
          releaseYear: movie.releaseYear,
        })),
      );
      await this.movieModel.deleteMany(filter);
      await this.assetModel.deleteMany({ movieId: { $in: objectIds } });
      await Promise.all(
        movies.flatMap((movie) => [this.artwork.remove(movie.posterKey), this.artwork.remove(movie.backdropKey)]),
      );
      return { matched: movies.length };
    }
    const $set: Record<string, unknown> = {};
    if (action === BulkMovieAction.Publish) {
      $set.published = true;
      $set.publishedAt = new Date();
    } else if (action === BulkMovieAction.Unpublish) {
      $set.published = false;
      $set.publishedAt = null;
    } else if (action === BulkMovieAction.Feature) {
      $set.featured = true;
    } else if (action === BulkMovieAction.Unfeature) {
      $set.featured = false;
    } else if (action === BulkMovieAction.Trending) {
      $set.trending = true;
    } else if (action === BulkMovieAction.Untrending) {
      $set.trending = false;
    } else if (action === BulkMovieAction.Popular) {
      $set.popular = true;
    } else if (action === BulkMovieAction.Unpopular) {
      $set.popular = false;
    }
    const result = await this.movieModel.updateMany(filter, { $set });
    if (action === BulkMovieAction.Unpublish) {
      await this.streams.revokeMedia(ids);
    }
    return { matched: result.modifiedCount };
  }

  async addMedia(movieId: string, dto: CreateMediaAssetDto): Promise<MediaAssetDocument> {
    this.rejectPathFields(dto as unknown as Record<string, unknown>);
    const movie = await this.movieModel.findById(movieId);
    if (!movie) {
      this.notFound();
    }
    if (dto.kind === MediaKind.Video && !dto.quality) {
      throw new BadRequestException({
        error: ErrorCode.ValidationFailed,
        message: 'Video versions require a quality (480p, 720p, 1080p, or 4k).',
      });
    }
    const isDefault =
      dto.isDefault ??
      ((await this.assetModel.countDocuments({ movieId: movie._id, kind: dto.kind })) === 0);
    if (isDefault) {
      await this.assetModel.updateMany(
        { movieId: movie._id, kind: dto.kind },
        { $set: { isDefault: false } },
      );
    }
    const asset = await this.assetModel.create({
      movieId: movie._id,
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
    await this.refreshAvailability(movie._id);
    return asset;
  }

  async updateMedia(movieId: string, assetId: string, dto: UpdateMediaAssetDto): Promise<MediaAssetDocument> {
    this.rejectPathFields(dto as unknown as Record<string, unknown>);
    const asset = await this.assetModel.findOne({
      _id: new Types.ObjectId(assetId),
      movieId: new Types.ObjectId(movieId),
    });
    if (!asset) {
      throw new NotFoundException({
        error: ErrorCode.MediaNotFound,
        message: 'Media asset not found.',
      });
    }
    if (dto.isDefault) {
      await this.assetModel.updateMany(
        { movieId: asset.movieId, kind: asset.kind, _id: { $ne: asset._id } },
        { $set: { isDefault: false } },
      );
    }
    const updated = await this.assetModel.findByIdAndUpdate(
      asset._id,
      { $set: dto },
      { returnDocument: 'after' },
    );
    if (!updated) {
      throw new NotFoundException({
        error: ErrorCode.MediaNotFound,
        message: 'Media asset not found.',
      });
    }
    await this.refreshAvailability(new Types.ObjectId(movieId));
    return updated;
  }

  async removeMedia(movieId: string, assetId: string): Promise<void> {
    const asset = await this.assetModel.findOneAndDelete({
      _id: new Types.ObjectId(assetId),
      movieId: new Types.ObjectId(movieId),
    });
    if (!asset) {
      throw new NotFoundException({
        error: ErrorCode.MediaNotFound,
        message: 'Media asset not found.',
      });
    }
    await this.refreshAvailability(new Types.ObjectId(movieId));
  }

  async attachArtwork(
    movieId: string,
    slot: 'poster' | 'backdrop',
    file: { mimetype: string; buffer: Buffer; size: number },
  ): Promise<MovieDocument> {
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
    const movie = await this.movieModel.findById(movieId);
    if (!movie) {
      this.notFound();
    }
    const oldKey = slot === 'poster' ? movie.posterKey : movie.backdropKey;
    const key = await this.artwork.save({ mimetype: mime, buffer: file.buffer });
    await this.artwork.remove(oldKey);
    const $set =
      slot === 'poster'
        ? { posterKey: key, posterUrl: null }
        : { backdropKey: key, backdropUrl: null };
    const updated = await this.movieModel.findByIdAndUpdate(movieId, { $set }, { returnDocument: 'after' });
    if (!updated) {
      this.notFound();
    }
    return updated;
  }

  async findArtworkOwner(key: string): Promise<MovieDocument | null> {
    return this.movieModel.findOne({ $or: [{ posterKey: key }, { backdropKey: key }] });
  }

  private async refreshAvailability(movieId: Types.ObjectId): Promise<void> {
    const movie = await this.movieModel.findById(movieId);
    if (!movie || movie.availability === MovieAvailability.ComingSoon) {
      return;
    }
    const videos = await this.assetModel.find({ movieId, kind: MediaKind.Video }).select('-storagePath');
    let availability: MovieAvailability = MovieAvailability.Unavailable;
    if (videos.some((asset) => asset.status === MediaAssetStatus.Ready)) {
      availability = MovieAvailability.Available;
    } else if (videos.some((asset) => asset.status === MediaAssetStatus.Processing)) {
      availability = MovieAvailability.Processing;
    }
    if (movie.availability !== availability) {
      movie.availability = availability;
      await movie.save();
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

  async playback(
    idOrSlug: string,
    user: RequestUser,
    quality: VideoQuality,
    extras?: {
      currentStreamCount?: number;
      deviceId?: string;
      deviceLabel?: string;
      clientIp?: string;
      hevcDirectStream?: boolean;
      forceVideoTranscode?: boolean;
    },
  ): Promise<MoviePlaybackResponse> {
    await this.profiles.ensureSessionProfile(user);
    const [viewer, entitlement, movie] = await Promise.all([
      this.resolveViewer(user),
      this.access.assertPlayback(user.id, { quality }),
      this.findByIdOrSlug(idOrSlug),
    ]);
    if (!movie || !movie.published || !profileCanViewMaturity(viewer.maturity, movie.maturityRating, viewer.isKids)) {
      this.notFound();
    }
    const videoAssets = await this.assetModel
      .find({
        movieId: movie._id,
        kind: MediaKind.Video,
        status: MediaAssetStatus.Ready,
      })
      .select('quality kind status');
    const publicMovie = toPublicMovie(movie, { entitlement, assets: videoAssets, progress: null });
    if (!publicMovie.playable) {
      throw new BadRequestException({
        error: ErrorCode.FeatureNotAllowed,
        message: 'This title is not available for playback.',
      });
    }
    const profileId = user.activeProfileId!;
    const [progress, session] = await Promise.all([
      this.history.get(user.id, profileId, String(movie._id)),
      this.streams.open({
        user,
        quality,
        deviceId: extras?.deviceId,
        deviceLabel: extras?.deviceLabel,
        clientIp: extras?.clientIp,
        mediaTitle: movie.title,
        clientHevc: extras?.hevcDirectStream,
        forceVideoTranscode: extras?.forceVideoTranscode,
        movieId: String(movie._id),
        durationSeconds: Math.max(movie.runtimeMinutes * 60, 1),
      }),
    ]);
    if (progress) {
      publicMovie.progressSeconds = progress.progressSeconds;
      publicMovie.durationSeconds = progress.durationSeconds;
      publicMovie.watched = progress.completed;
    }
    if (!session) {
      throw new BadRequestException({
        error: ErrorCode.PlaybackUnavailable,
        message:
          'No streamable video file is linked to this title. Re-scan the library or convert the file to MP4 (H.264 + AAC).',
      });
    }
    return {
      allowed: true,
      quality,
      movie: publicMovie,
      session,
      markers: toPlaybackMarkers(movie.markers),
      resumeSeconds: progress?.progressSeconds ?? 0,
      progress,
    };
  }

  async saveProgress(
    idOrSlug: string,
    user: RequestUser,
    dto: { progressSeconds: number; durationSeconds: number },
  ): Promise<MovieProgressResponse> {
    const profileId = this.requireProfile(user);
    const viewer = await this.resolveViewer(user);
    const movie = await this.findByIdOrSlug(idOrSlug);
    if (!movie || !movie.published || !profileCanViewMaturity(viewer.maturity, movie.maturityRating, viewer.isKids)) {
      this.notFound();
    }
    const progress = await this.history.upsert(user.id, profileId, {
      mediaId: String(movie._id),
      progressSeconds: dto.progressSeconds,
      durationSeconds: dto.durationSeconds,
    });
    return { movie: toPublicMovie(movie, { admin: false, progress }), progress };
  }

  async setWatched(idOrSlug: string, user: RequestUser, watched: boolean): Promise<MovieProgressResponse> {
    const profileId = this.requireProfile(user);
    const viewer = await this.resolveViewer(user);
    const movie = await this.findByIdOrSlug(idOrSlug);
    if (!movie || !movie.published || !profileCanViewMaturity(viewer.maturity, movie.maturityRating, viewer.isKids)) {
      this.notFound();
    }
    const duration = Math.max(movie.runtimeMinutes * 60, 1);
    if (watched) {
      const progress = await this.history.upsert(user.id, profileId, {
        mediaId: String(movie._id),
        progressSeconds: duration,
        durationSeconds: duration,
      });
      return { movie: toPublicMovie(movie, { admin: false, progress }), progress };
    }
    await this.history.remove(user.id, profileId, String(movie._id));
    const empty: WatchProgress = {
      id: '',
      profileId,
      mediaId: String(movie._id),
      progressSeconds: 0,
      durationSeconds: duration,
      completed: false,
      lastWatchedAt: new Date().toISOString(),
    };
    return { movie: toPublicMovie(movie, { admin: false, progress: empty }), progress: empty };
  }

  async continueWatching(user: RequestUser): Promise<{ items: MovieContinueItem[] }> {
    if (!user.activeProfileId) {
      return { items: [] };
    }
    const viewer = await this.resolveViewer(user);
    const rows = await this.history.continueWatching(user.id, user.activeProfileId);
    const movieIds = rows
      .map((row) => row.mediaId)
      .filter((id) => Types.ObjectId.isValid(id) && id.length === 24)
      .map((id) => new Types.ObjectId(id));
    if (movieIds.length === 0) {
      return { items: [] };
    }
    const movies = await this.movieModel.find({
      _id: { $in: movieIds },
      published: true,
      ...this.maturityFilter(viewer.maturity, viewer.isKids),
    });
    const assets = await this.assetsByMovie(movies.map((item) => item._id));
    const items: MovieContinueItem[] = [];
    for (const row of rows) {
      const movie = movies.find((item) => String(item._id) === row.mediaId);
      if (!movie) continue;
      const pub = toPublicMovie(movie, { assets: assets.get(String(movie._id)) ?? [] });
      items.push({
        movie: {
          ...pub,
          progressSeconds: row.progressSeconds,
          durationSeconds: row.durationSeconds,
          watched: row.completed,
        },
        progress: row,
      });
    }
    return { items };
  }

  async listTracks(query: {
    kind?: MediaKind;
    q?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
    const kind =
      query.kind === MediaKind.Audio || query.kind === MediaKind.Subtitle
        ? query.kind
        : { $in: [MediaKind.Audio, MediaKind.Subtitle] };
    const filter: Record<string, unknown> = { kind };
    if (query.q?.trim()) {
      const q = query.q.trim();
      filter.$or = [
        { label: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { language: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { codec: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      ];
    }
    const [items, total] = await Promise.all([
      this.assetModel.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).exec(),
      this.assetModel.countDocuments(filter),
    ]);
    return {
      items: items.map((asset) => ({
        id: String(asset._id),
        kind: asset.kind,
        movieId: asset.movieId ? String(asset.movieId) : null,
        episodeId: asset.episodeId ? String(asset.episodeId) : null,
        label: asset.label ?? null,
        language: asset.language ?? null,
        quality: asset.quality ?? null,
        format: asset.format ?? null,
        codec: asset.codec ?? null,
        channels: asset.channels ?? null,
        status: asset.status,
        isDefault: asset.isDefault,
        createdAt: asset.createdAt.toISOString(),
      })),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }
}

function uniqueObjectIds(ids: string[]): Types.ObjectId[] {
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
