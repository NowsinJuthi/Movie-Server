import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
} from '@movie-server/shared';
import { MediaLibrary, MediaLibraryDocument } from './schemas/media-library.schema';
import { LibraryItem, LibraryItemDocument } from './schemas/library-item.schema';
import { MediaAsset, MediaAssetDocument } from '../movies/schemas/media-asset.schema';
import { Movie, MovieDocument } from '../movies/schemas/movie.schema';
import { Episode, EpisodeDocument } from '../series/schemas/episode.schema';
import { UpdateLibraryDto, UpsertLibraryDto } from './dto/upsert-library.dto';
import { QueryLibraryItemsDto } from './dto/query-library-items.dto';
import { toAdminLibrary, toAdminLibraryItem } from './library.mapper';
import { assertSafeLibraryRoot, isUncPath } from './storage/path-safety';
import { looksLikeFilesystemPath } from '../movies/movie.util';
import { escapeRegex } from '../movies/movie.util';
import { ArtworkStorageService } from '../movies/artwork-storage.service';
import { sniffImageMime } from '../common/security/image-bytes';

@Injectable()
export class LibraryService implements OnModuleInit {
  private readonly logger = new Logger(LibraryService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectModel(MediaLibrary.name) private readonly libraries: Model<MediaLibraryDocument>,
    @InjectModel(LibraryItem.name) private readonly items: Model<LibraryItemDocument>,
    @InjectModel(MediaAsset.name) private readonly assets: Model<MediaAssetDocument>,
    @InjectModel(Movie.name) private readonly movies: Model<MovieDocument>,
    @InjectModel(Episode.name) private readonly episodes: Model<EpisodeDocument>,
    private readonly artwork: ArtworkStorageService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedFromEnv('MEDIA_MOVIES_DIR', 'Movies', LibraryKind.Movies);
    await this.seedFromEnv('MEDIA_TV_DIR', 'TV', LibraryKind.Tv);
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

  private async countsFor(libraryId: Types.ObjectId) {
    const [itemCount, readyCount, missingCount, unmatchedCount] = await Promise.all([
      this.items.countDocuments({ libraryId }),
      this.items.countDocuments({ libraryId, status: LibraryItemStatus.Ready }),
      this.items.countDocuments({ libraryId, status: LibraryItemStatus.Missing }),
      this.items.countDocuments({ libraryId, status: LibraryItemStatus.Unmatched }),
    ]);
    return { itemCount, readyCount, missingCount, unmatchedCount };
  }

  private async seedFromEnv(envKey: string, name: string, kind: LibraryKind): Promise<void> {
    const raw = this.config.get<string>(envKey);
    if (!raw) {
      return;
    }
    try {
      const rootPath = assertSafeLibraryRoot(raw);
      await fs.mkdir(rootPath, { recursive: true });
      const existing = await this.libraries.findOne({ name, kind }).select('+rootPath');
      if (existing) {
        existing.rootPath = rootPath;
        existing.enabled = true;
        existing.provider = StorageProviderKind.Local;
        await existing.save();
        return;
      }
      await this.libraries.create({
        name,
        kind,
        provider: StorageProviderKind.Local,
        rootPath,
        enabled: true,
      });
    } catch (error) {
      this.logger.warn(`Skipping ${envKey} library seed: ${error instanceof Error ? error.message : error}`);
    }
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
