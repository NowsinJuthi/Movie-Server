import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { promises as fs } from 'fs';
import {
  ErrorCode,
  LibraryItemStatus,
  LibraryKind,
  MediaAssetStatus,
  MediaKind,
  MovieAvailability,
  StorageProviderKind,
  type PublicLibraryBrowseResponse,
  type SubscriptionEntitlement,
} from '@movie-server/shared';
import { MediaLibrary, MediaLibraryDocument } from './schemas/media-library.schema';
import { LibraryItem, LibraryItemDocument } from './schemas/library-item.schema';
import { MediaAsset, MediaAssetDocument } from '../movies/schemas/media-asset.schema';
import { Movie, MovieDocument } from '../movies/schemas/movie.schema';
import { Episode, EpisodeDocument } from '../series/schemas/episode.schema';
import { Series, SeriesDocument } from '../series/schemas/series.schema';
import { Season, SeasonDocument } from '../series/schemas/season.schema';
import { UpdateLibraryDto, UpsertLibraryDto } from './dto/upsert-library.dto';
import { QueryLibraryItemsDto } from './dto/query-library-items.dto';
import { toAdminLibrary, toAdminLibraryItem, toPublicLibrary } from './library.mapper';
import { assertSafeLibraryRoot, isUncPath } from './storage/path-safety';
import { looksLikeFilesystemPath } from '../movies/movie.util';
import { escapeRegex } from '../movies/movie.util';
import { ArtworkStorageService } from '../movies/artwork-storage.service';
import { sniffImageMime } from '../common/security/image-bytes';
import { toPublicMovie } from '../movies/movie.mapper';
import { toPublicSeries } from '../series/series.mapper';
import { movieToHomeCard, seriesToHomeCard } from '../home/home-card.util';
import { StreamService } from '../stream/stream.service';

@Injectable()
export class LibraryService implements OnModuleInit {
  private readonly logger = new Logger(LibraryService.name);

  constructor(
    @InjectModel(MediaLibrary.name) private readonly libraries: Model<MediaLibraryDocument>,
    @InjectModel(LibraryItem.name) private readonly items: Model<LibraryItemDocument>,
    @InjectModel(MediaAsset.name) private readonly assets: Model<MediaAssetDocument>,
    @InjectModel(Movie.name) private readonly movies: Model<MovieDocument>,
    @InjectModel(Episode.name) private readonly episodes: Model<EpisodeDocument>,
    @InjectModel(Series.name) private readonly series: Model<SeriesDocument>,
    @InjectModel(Season.name) private readonly seasons: Model<SeasonDocument>,
    private readonly artwork: ArtworkStorageService,
    @Optional() private readonly streams?: StreamService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Clean titles left unavailable after earlier soft-missing scans.
    void this.purgeUnplayableLibraryTitles()
      .then(() => this.dedupeEmptyDuplicateMovies())
      .catch((error) => {
        this.logger.warn(
          `Orphan catalog cleanup failed: ${error instanceof Error ? error.message : error}`,
        );
      });
  }

  async list() {
    const docs = await this.libraries.find().select('+rootPath').sort({ name: 1 });
    const libraries = await Promise.all(
      docs.map(async (library) => {
        const counts = await this.countsFor(library._id);
        return toAdminLibrary(library, counts, library.rootPath);
      }),
    );
    return { libraries };
  }

  async listPublic() {
    const docs = await this.libraries.find({ enabled: true }).sort({ name: 1 });
    return { libraries: docs.map((library) => toPublicLibrary(library)) };
  }

  async browsePublic(
    id: string,
    entitlement?: SubscriptionEntitlement | null,
  ): Promise<PublicLibraryBrowseResponse> {
    const library = await this.requireLibrary(id);
    if (!library.enabled) {
      throw new NotFoundException({
        error: ErrorCode.LibraryNotFound,
        message: 'Media library not found.',
      });
    }

    const pub = toPublicLibrary(library);
    const myList = new Set<string>();

    if (library.kind === LibraryKind.Movies) {
      const rows = await this.items
        .find({ libraryId: library._id, movieId: { $ne: null }, ignored: { $ne: true } })
        .select('movieId');
      const movieIds = [
        ...new Set(rows.map((row) => (row.movieId ? String(row.movieId) : '')).filter(Boolean)),
      ].map((movieId) => new Types.ObjectId(movieId));

      if (!movieIds.length) {
        return { library: pub, items: [] };
      }

      const movies = await this.movies.find({ _id: { $in: movieIds }, published: true }).sort({ title: 1 });
      const assets = await this.assets
        .find({ movieId: { $in: movies.map((movie) => movie._id) }, kind: MediaKind.Video })
        .select('movieId kind quality status');
      const byMovie = new Map<string, typeof assets>();
      for (const asset of assets) {
        const key = String(asset.movieId);
        const list = byMovie.get(key) ?? [];
        list.push(asset);
        byMovie.set(key, list);
      }

      return {
        library: pub,
        items: movies.map((movie) =>
          movieToHomeCard(
            toPublicMovie(movie, {
              entitlement,
              assets: byMovie.get(String(movie._id)) ?? [],
            }),
            myList,
          ),
        ),
      };
    }

    const rows = await this.items
      .find({ libraryId: library._id, seriesId: { $ne: null }, ignored: { $ne: true } })
      .select('seriesId');
    const seriesIds = [
      ...new Set(rows.map((row) => (row.seriesId ? String(row.seriesId) : '')).filter(Boolean)),
    ].map((seriesId) => new Types.ObjectId(seriesId));

    if (!seriesIds.length) {
      return { library: pub, items: [] };
    }

    const seriesDocs = await this.series.find({ _id: { $in: seriesIds }, published: true }).sort({ title: 1 });
    return {
      library: pub,
      items: seriesDocs.map((doc) => seriesToHomeCard(toPublicSeries(doc), myList)),
    };
  }

  async create(dto: UpsertLibraryDto) {
    this.rejectPathFields(dto as unknown as Record<string, unknown>, ['rootPath']);
    if ((dto.provider ?? StorageProviderKind.Local) === StorageProviderKind.S3) {
      throw new BadRequestException({
        error: ErrorCode.StorageNotImplemented,
        message: 'Object storage is not configured yet.',
      });
    }
    const rootPath = assertSafeLibraryRoot(dto.rootPath);
    if (!isUncPath(rootPath)) {
      await fs.mkdir(rootPath, { recursive: true });
    }
    const library = await this.libraries.create({
      name: dto.name,
      kind: dto.kind,
      provider: StorageProviderKind.Local,
      rootPath,
      enabled: dto.enabled ?? true,
      imageUrl: dto.imageUrl ?? null,
      imageKey: null,
    });
    return { library: toAdminLibrary(library, await this.countsFor(library._id), rootPath) };
  }

  async createFromExternalRoot(input: {
    name: string;
    kind: LibraryKind;
    rootPath: string;
    provider: StorageProviderKind;
    smbServerId?: string;
    smbShare?: string;
    smbRemotePath?: string;
  }) {
    const rootPath = assertSafeLibraryRoot(input.rootPath);
    if (!isUncPath(rootPath) && input.provider === StorageProviderKind.Local) {
      await fs.mkdir(rootPath, { recursive: true });
    }
    try {
      await fs.access(rootPath);
    } catch {
      throw new BadRequestException({
        error: ErrorCode.InvalidLibraryPath,
        message: 'Media directory is not accessible. Check Samba credentials and share path.',
      });
    }
    const library = await this.libraries.create({
      name: input.name,
      kind: input.kind,
      provider: input.provider === StorageProviderKind.Smb ? StorageProviderKind.Smb : StorageProviderKind.Local,
      rootPath,
      enabled: true,
      imageUrl: null,
      imageKey: null,
      smbServerId: input.smbServerId ? new Types.ObjectId(input.smbServerId) : null,
      smbShare: input.smbShare ?? null,
      smbRemotePath: input.smbRemotePath ?? null,
    });
    return { library: toAdminLibrary(library, await this.countsFor(library._id), rootPath) };
  }

  async one(id: string) {
    const library = await this.requireLibrary(id);
    return { library: toAdminLibrary(library, await this.countsFor(library._id), library.rootPath) };
  }

  async update(id: string, dto: UpdateLibraryDto) {
    this.rejectPathFields(dto as unknown as Record<string, unknown>, ['rootPath']);
    const library = await this.requireLibrary(id);
    if (dto.provider === StorageProviderKind.S3) {
      throw new BadRequestException({
        error: ErrorCode.StorageNotImplemented,
        message: 'Object storage is not configured yet.',
      });
    }
    if (dto.name) library.name = dto.name;
    if (dto.enabled !== undefined) library.enabled = dto.enabled;
    if (dto.rootPath) {
      if (library.provider === StorageProviderKind.Smb) {
        throw new BadRequestException({
          error: ErrorCode.ValidationFailed,
          message: 'Samba library paths are managed by the Samba file manager.',
        });
      }
      library.rootPath = assertSafeLibraryRoot(dto.rootPath);
      if (!isUncPath(library.rootPath)) {
        await fs.mkdir(library.rootPath, { recursive: true });
      }
    }
    if (dto.imageUrl !== undefined) {
      const previousKey = library.imageKey;
      library.imageUrl = dto.imageUrl;
      library.imageKey = null;
      if (previousKey) {
        await this.artwork.remove(previousKey);
      }
    }
    await library.save();
    return { library: toAdminLibrary(library, await this.countsFor(library._id), library.rootPath) };
  }

  async attachImage(
    id: string,
    file: { mimetype: string; buffer: Buffer; size: number },
  ) {
    const mime = sniffImageMime(file.buffer);
    if (!mime || !this.artwork.isAllowed(mime)) {
      throw new BadRequestException({
        error: ErrorCode.ValidationFailed,
        message: 'Image must be JPEG, PNG, or WebP.',
      });
    }
    if (file.size > this.artwork.maxBytes()) {
      throw new BadRequestException({
        error: ErrorCode.ValidationFailed,
        message: 'Image is too large.',
      });
    }
    const library = await this.requireLibrary(id);
    const previousKey = library.imageKey;
    const key = await this.artwork.save({ mimetype: mime, buffer: file.buffer });
    library.imageKey = key;
    library.imageUrl = null;
    await library.save();
    if (previousKey && previousKey !== key) {
      await this.artwork.remove(previousKey);
    }
    return { library: toAdminLibrary(library, await this.countsFor(library._id), library.rootPath) };
  }

  async remove(id: string) {
    const library = await this.requireLibrary(id);
    const items = await this.items.find({ libraryId: library._id });
    const itemIds = items.map((item) => item._id);
    if (itemIds.length) {
      await this.assets.updateMany(
        { libraryItemId: { $in: itemIds } },
        { $set: { status: MediaAssetStatus.Missing } },
      );
      const movieIds = [...new Set(items.map((item) => item.movieId).filter(Boolean).map(String))];
      const episodeIds = [...new Set(items.map((item) => item.episodeId).filter(Boolean).map(String))];
      await Promise.all([
        ...movieIds.map((movieId) => this.refreshMovieAvailability(new Types.ObjectId(movieId))),
        ...episodeIds.map((episodeId) => this.refreshEpisodeAvailability(new Types.ObjectId(episodeId))),
      ]);
      await Promise.all([
        ...movieIds.map((movieId) => this.purgeMovieIfUnplayable(new Types.ObjectId(movieId))),
        ...episodeIds.map((episodeId) => this.purgeEpisodeIfUnplayable(new Types.ObjectId(episodeId))),
      ]);
    }
    await this.items.deleteMany({ libraryId: library._id });
    await this.libraries.deleteOne({ _id: library._id });
    return { deleted: true };
  }

  async listItems(libraryId: string, query: QueryLibraryItemsDto) {
    await this.requireLibrary(libraryId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const filter: Record<string, unknown> = { libraryId: new Types.ObjectId(libraryId) };
    if (query.status) filter.status = query.status;
    if (query.match) filter.match = query.match;
    if (query.q?.trim()) {
      const rx = new RegExp(escapeRegex(query.q.trim()), 'i');
      filter.$or = [{ relativePath: rx }, { matchTitle: rx }, { storageKey: rx }];
    }
    const [rows, total] = await Promise.all([
      this.items
        .find(filter)
        .sort({ relativePath: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.items.countDocuments(filter),
    ]);
    return {
      items: rows.map((item) => toAdminLibraryItem(item)),
      total,
      page,
      limit,
    };
  }

  async requireLibrary(id: string): Promise<MediaLibraryDocument> {
    const library = await this.libraries.findById(id).select('+rootPath');
    if (!library) {
      throw new NotFoundException({
        error: ErrorCode.LibraryNotFound,
        message: 'Media library not found.',
      });
    }
    return library;
  }

  async refreshMovieAvailability(movieId: Types.ObjectId): Promise<void> {
    const movie = await this.movies.findById(movieId);
    if (!movie || movie.availability === MovieAvailability.ComingSoon) {
      return;
    }
    const videos = await this.assets.find({ movieId, kind: MediaKind.Video }).select('-storagePath');
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

  async refreshEpisodeAvailability(episodeId: Types.ObjectId): Promise<void> {
    const episode = await this.episodes.findById(episodeId);
    if (!episode || episode.availability === MovieAvailability.ComingSoon) {
      return;
    }
    const videos = await this.assets.find({ episodeId, kind: MediaKind.Video }).select('-storagePath');
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

  /**
   * When library files are gone, remove the catalog title everywhere (collections, assets, items).
   * Does not write rescan exclusions — putting the file back can re-import.
   */
  async purgeMovieIfUnplayable(movieId: Types.ObjectId): Promise<boolean> {
    const movie = await this.movies.findById(movieId);
    if (!movie || movie.availability === MovieAvailability.ComingSoon) {
      return false;
    }
    const videos = await this.assets.find({ movieId, kind: MediaKind.Video }).select('-storagePath');
    if (videos.length === 0) {
      // Manual / Add Manually drafts with no media — keep.
      return false;
    }
    if (
      videos.some(
        (asset) =>
          asset.status === MediaAssetStatus.Ready || asset.status === MediaAssetStatus.Processing,
      )
    ) {
      return false;
    }

    await this.streams?.revokeMedia([String(movieId)]);
    await this.items.deleteMany({ movieId });
    await this.assets.deleteMany({ movieId });
    await this.movies.findByIdAndDelete(movieId);
    await Promise.all([this.artwork.remove(movie.posterKey), this.artwork.remove(movie.backdropKey)]);
    this.logger.log(`Purged unplayable movie ${movie.title} (${movieId})`);
    return true;
  }

  async purgeEpisodeIfUnplayable(episodeId: Types.ObjectId): Promise<boolean> {
    const episode = await this.episodes.findById(episodeId);
    if (!episode || episode.availability === MovieAvailability.ComingSoon) {
      return false;
    }
    const videos = await this.assets.find({ episodeId, kind: MediaKind.Video }).select('-storagePath');
    if (videos.length === 0) {
      return false;
    }
    if (
      videos.some(
        (asset) =>
          asset.status === MediaAssetStatus.Ready || asset.status === MediaAssetStatus.Processing,
      )
    ) {
      return false;
    }

    const seriesId = episode.seriesId;
    await this.streams?.revokeMedia([String(episodeId)]);
    await this.items.deleteMany({ episodeId });
    await this.assets.deleteMany({ episodeId });
    await this.episodes.findByIdAndDelete(episodeId);
    await this.artwork.remove(episode.thumbnailKey);

    const remaining = await this.episodes.countDocuments({ seriesId });
    if (remaining === 0) {
      const series = await this.series.findById(seriesId);
      if (series) {
        await this.seasons.deleteMany({ seriesId });
        await this.series.findByIdAndDelete(seriesId);
        await Promise.all([
          this.artwork.remove(series.posterKey),
          this.artwork.remove(series.backdropKey),
        ]);
        this.logger.log(`Purged empty series ${series.title} (${seriesId})`);
      }
    }

    this.logger.log(`Purged unplayable episode ${episode.title} (${episodeId})`);
    return true;
  }

  /** One-shot / scan cleanup for titles that only have missing assets. */
  async purgeUnplayableLibraryTitles(): Promise<{ movies: number; episodes: number }> {
    const movieIds = await this.assets.distinct('movieId', {
      movieId: { $ne: null },
      kind: MediaKind.Video,
    });
    const episodeIds = await this.assets.distinct('episodeId', {
      episodeId: { $ne: null },
      kind: MediaKind.Video,
    });

    let movies = 0;
    let episodes = 0;
    for (const id of movieIds) {
      if (!id) continue;
      if (await this.purgeMovieIfUnplayable(id as Types.ObjectId)) movies += 1;
    }
    for (const id of episodeIds) {
      if (!id) continue;
      if (await this.purgeEpisodeIfUnplayable(id as Types.ObjectId)) episodes += 1;
    }
    if (movies || episodes) {
      this.logger.log(`Purged unplayable catalog titles: ${movies} movies, ${episodes} episodes`);
    }
    return { movies, episodes };
  }

  /**
   * Remove empty duplicate movie rows left by older scans that re-created the same TMDB title.
   * Keeps the copy with the most Ready/Processing videos (then any videos, then newest).
   */
  async dedupeEmptyDuplicateMovies(): Promise<number> {
    const groups = await this.movies.aggregate<{
      _id: { title: string; year: number | null };
      ids: Types.ObjectId[];
      count: number;
    }>([
      {
        $group: {
          _id: {
            title: { $toLower: '$title' },
            year: { $ifNull: ['$releaseYear', null] },
          },
          ids: { $push: '$_id' },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ]);

    let removed = 0;
    for (const group of groups) {
      const scored: { id: Types.ObjectId; ready: number; videos: number; createdAt: number }[] = [];
      for (const id of group.ids) {
        const [ready, videos, movie] = await Promise.all([
          this.assets.countDocuments({
            movieId: id,
            kind: MediaKind.Video,
            status: { $in: [MediaAssetStatus.Ready, MediaAssetStatus.Processing] },
          }),
          this.assets.countDocuments({ movieId: id, kind: MediaKind.Video }),
          this.movies.findById(id).select('createdAt'),
        ]);
        scored.push({
          id,
          ready,
          videos,
          createdAt: movie?.createdAt?.getTime() ?? 0,
        });
      }
      scored.sort((a, b) => b.ready - a.ready || b.videos - a.videos || b.createdAt - a.createdAt);
      const keeper = scored[0];
      if (!keeper) continue;

      for (const loser of scored.slice(1)) {
        // Only drop empties / fully missing copies so we never merge two real files incorrectly.
        if (loser.ready > 0) continue;
        const movie = await this.movies.findById(loser.id);
        if (!movie) continue;
        await this.items.updateMany({ movieId: loser.id }, { $set: { movieId: keeper.id } });
        await this.assets.updateMany({ movieId: loser.id }, { $set: { movieId: keeper.id } });
        await this.streams?.revokeMedia([String(loser.id)]);
        await this.movies.findByIdAndDelete(loser.id);
        await Promise.all([
          this.artwork.remove(movie.posterKey),
          this.artwork.remove(movie.backdropKey),
        ]);
        removed += 1;
        this.logger.log(
          `Removed duplicate movie "${movie.title}" (${loser.id}); kept ${keeper.id}`,
        );
      }
      await this.refreshMovieAvailability(keeper.id);
    }

    if (removed) {
      this.logger.log(`Deduped ${removed} empty duplicate movie(s)`);
    }
    return removed;
  }

  private async countsFor(libraryId: Types.ObjectId) {
    const [itemCount, readyCount, missingCount, unmatchedCount] = await Promise.all([
      this.items.countDocuments({ libraryId }),
      this.items.countDocuments({ libraryId, status: LibraryItemStatus.Ready }),
      this.items.countDocuments({ libraryId, status: LibraryItemStatus.Missing }),
      this.items.countDocuments({ libraryId, status: LibraryItemStatus.Unmatched }),
    ]);
    return { itemCount, readyCount, missingCount, unmatchedCount };
  }

  private rejectPathFields(dto: Record<string, unknown>, allow: string[]): void {
    for (const [key, value] of Object.entries(dto)) {
      if (allow.includes(key)) continue;
      if (looksLikeFilesystemPath(value) || /path/i.test(key)) {
        throw new BadRequestException({
          error: ErrorCode.ValidationFailed,
          message: 'Filesystem paths are not accepted on this field.',
        });
      }
    }
  }
}
