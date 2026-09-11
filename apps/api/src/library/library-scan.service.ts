import { ConflictException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Model, Types } from 'mongoose';
import {
  ErrorCode,
  LibraryFileKind,
  LibraryItemStatus,
  LibraryKind,
  LibraryLogLevel,
  LibraryMatchType,
  LibraryScanStatus,
  MediaAssetStatus,
  MediaKind,
  StorageProviderKind,
  asProfileLanguage,
  languageLabel,
  type SubtitleFormat,
} from '@movie-server/shared';
import { RedisService } from '../redis/redis.service';
import { MediaLibrary, MediaLibraryDocument } from './schemas/media-library.schema';
import { LibraryItem, LibraryItemDocument } from './schemas/library-item.schema';
import { LibraryScan, LibraryScanDocument } from './schemas/library-scan.schema';
import { LibraryScanLog, LibraryScanLogDocument } from './schemas/library-scan-log.schema';
import { MediaAsset, MediaAssetDocument } from '../movies/schemas/media-asset.schema';
import { LibraryService } from './library.service';
import { LibraryImportService } from './library-import.service';
import { MediaProbeService } from './probe/media-probe.service';
import { StorageFactory } from './storage/storage.factory';
import { fingerprintFile } from './content-hash';
import { detectLanguageHint, isAudioFile, isSubtitleFile, isVideoFile } from './matching/filename-parser';
import { subtitleFormatFromName } from '../stream/subtitle-text';
import { sanitizeScanMessage } from './scan-log.util';
import { toAdminLog, toAdminScan } from './library.mapper';
import { newStorageKey } from '../movies/movie.util';
import { StartScanDto } from './dto/start-scan.dto';
import path from 'path';

export const LIBRARY_SCAN_QUEUE = 'library-scan';
const LOCK_KEY = 'library:scan:lock';
const LOCK_MS = 30 * 60 * 1000;

@Injectable()
export class LibraryScanService {
  private readonly logger = new Logger(LibraryScanService.name);
  private scanLogRoots: string[] = [];

  constructor(
    private readonly libraries: LibraryService,
    private readonly importer: LibraryImportService,
    private readonly probe: MediaProbeService,
    private readonly storageFactory: StorageFactory,
    private readonly redis: RedisService,
    @InjectModel(MediaLibrary.name) private readonly libraryModel: Model<MediaLibraryDocument>,
    @InjectModel(LibraryItem.name) private readonly items: Model<LibraryItemDocument>,
    @InjectModel(LibraryScan.name) private readonly scans: Model<LibraryScanDocument>,
    @InjectModel(LibraryScanLog.name) private readonly logs: Model<LibraryScanLogDocument>,
    @InjectModel(MediaAsset.name) private readonly assets: Model<MediaAssetDocument>,
    @Optional() @InjectQueue(LIBRARY_SCAN_QUEUE) private readonly queue?: Queue,
  ) {}

  async start(dto: StartScanDto) {
    if (dto.libraryId) {
      await this.libraries.requireLibrary(dto.libraryId);
    }
    const busy = await this.scans.findOne({
      status: { $in: [LibraryScanStatus.Queued, LibraryScanStatus.Running] },
    });
    if (busy) {
      throw new ConflictException({
        error: ErrorCode.ScanInProgress,
        message: 'A library scan is already running.',
      });
    }
    const scan = await this.scans.create({
      libraryId: dto.libraryId ? new Types.ObjectId(dto.libraryId) : null,
      full: Boolean(dto.full),
      status: LibraryScanStatus.Queued,
    });
    const scanId = String(scan._id);
    await this.log(scan, LibraryLogLevel.Info, dto.libraryId ? 'Scan queued for one library.' : 'Scan queued for all libraries.');
    if (this.queue) {
      await this.queue.add('scan', { scanId }, { jobId: scanId, removeOnComplete: 100, removeOnFail: 50 });
    } else {
      setImmediate(() => {
        this.execute(scanId).catch((error) => this.logger.error(error));
      });
    }
    return { scan: toAdminScan(scan) };
  }

  async listScans() {
    const rows = await this.scans.find().sort({ createdAt: -1 }).limit(50);
    return { scans: rows.map((scan) => toAdminScan(scan)) };
  }

  async oneScan(id: string) {
    const scan = await this.requireScan(id);
    return { scan: toAdminScan(scan) };
  }

  async logsFor(id: string) {
    await this.requireScan(id);
    const rows = await this.logs.find({ scanId: new Types.ObjectId(id) }).sort({ createdAt: 1 }).limit(500);
    return { logs: rows.map((row) => toAdminLog(row)) };
  }

  async cancel(id: string) {
    const scan = await this.requireScan(id);
    if (
      scan.status === LibraryScanStatus.Completed ||
      scan.status === LibraryScanStatus.Failed ||
      scan.status === LibraryScanStatus.Cancelled
    ) {
      return { scan: toAdminScan(scan) };
    }
    await this.redis.client.set(this.cancelKey(id), '1', 'PX', 60 * 60 * 1000);
    if (scan.status === LibraryScanStatus.Queued) {
      scan.status = LibraryScanStatus.Cancelled;
      scan.finishedAt = new Date();
      await scan.save();
      await this.log(scan, LibraryLogLevel.Warn, 'Scan cancelled before it started.');
    }
    return { scan: toAdminScan(scan) };
  }

  async execute(scanId: string): Promise<void> {
    const scan = await this.scans.findById(scanId);
    if (!scan) {
      return;
    }
    if (scan.status === LibraryScanStatus.Cancelled || (await this.isCancelled(scanId))) {
      scan.status = LibraryScanStatus.Cancelled;
      scan.finishedAt = new Date();
      await scan.save();
      return;
    }
    await this.redis.client.set(LOCK_KEY, scanId, 'PX', LOCK_MS);
    scan.status = LibraryScanStatus.Running;
    scan.startedAt = new Date();
    await scan.save();
    this.scanLogRoots = (await this.libraryModel.find().select('+rootPath'))
      .map((item) => item.rootPath)
      .filter((root): root is string => Boolean(root));
    await this.progress(scan);
    await this.log(scan, LibraryLogLevel.Info, 'Scan started.');

    try {
      const targets = scan.libraryId
        ? [await this.libraryModel.findById(scan.libraryId).select('+rootPath')]
        : await this.libraryModel.find({ enabled: true }).select('+rootPath');
      for (const library of targets) {
        if (!library) continue;
        if (await this.isCancelled(scanId)) {
          break;
        }
        await this.scanLibrary(scan, library);
      }
      const latest = await this.scans.findById(scanId);
      if (!latest) return;
      if (latest.status === LibraryScanStatus.Cancelled || (await this.isCancelled(scanId))) {
        latest.status = LibraryScanStatus.Cancelled;
        latest.finishedAt = new Date();
        await latest.save();
        await this.log(latest, LibraryLogLevel.Warn, 'Scan cancelled.');
        await this.progress(latest);
        return;
      }
      latest.status = LibraryScanStatus.Completed;
      latest.finishedAt = new Date();
      await latest.save();
      await this.log(latest, LibraryLogLevel.Info, 'Scan completed.');
      await this.progress(latest);
    } catch (error) {
      scan.status = LibraryScanStatus.Failed;
      scan.finishedAt = new Date();
      await scan.save();
      await this.log(scan, LibraryLogLevel.Error, error instanceof Error ? error.message : 'Scan failed.');
      await this.progress(scan);
      this.logger.error(error);
    } finally {
      this.scanLogRoots = [];
      await this.redis.client.del(LOCK_KEY, this.cancelKey(scanId), this.progressKey(scanId));
    }
  }

  private async scanLibrary(scan: LibraryScanDocument, library: MediaLibraryDocument): Promise<void> {
    if (
      library.provider !== StorageProviderKind.Local &&
      library.provider !== StorageProviderKind.Smb
    ) {
      await this.log(scan, LibraryLogLevel.Warn, `Skipping ${library.name}: storage provider is not available.`);
      return;
    }
    const storage = this.storageFactory.create(library.provider, library.rootPath);
    const listed = await storage.list();
    const files = listed.filter(
      (file) => isVideoFile(file.key) || isSubtitleFile(file.key) || isAudioFile(file.key),
    );
    scan.total += files.length;
    scan.discovered += files.length;
    await scan.save();
    await this.log(scan, LibraryLogLevel.Info, `Scanning ${library.name}: ${files.length} media files.`);

    for (const file of files) {
      if (await this.isCancelled(String(scan._id))) {
        return;
      }
      try {
        await this.processFile(scan, library, file.key, file.sizeBytes, file.mtimeMs);
      } catch (error) {
        scan.errorCount += 1;
        await this.log(
          scan,
          LibraryLogLevel.Error,
          `Failed ${path.posix.basename(file.key)}: ${error instanceof Error ? error.message : 'error'}`,
        );
      }
      scan.processed += 1;
      if (scan.processed % 5 === 0) {
        await scan.save();
        await this.progress(scan);
      }
    }
    if (await this.isCancelled(String(scan._id))) {
      await scan.save();
      return;
    }
    await this.rematchSidecars(scan, library);
    await this.markMissing(scan, library);
    await scan.save();
    await this.progress(scan);
  }

  private async processFile(
    scan: LibraryScanDocument,
    library: MediaLibraryDocument,
    relativePath: string,
    sizeBytes: number,
    mtimeMs: number,
  ): Promise<void> {
    const storage = this.storageFactory.create(library.provider, library.rootPath);
    const absPath = storage.resolveSafe(relativePath);
    const fileName = path.posix.basename(relativePath.replace(/\\/g, '/'));
    const fileKind = isSubtitleFile(fileName)
      ? LibraryFileKind.Subtitle
      : isAudioFile(fileName)
        ? LibraryFileKind.Audio
        : LibraryFileKind.Video;
    const contentHash = await fingerprintFile(absPath, sizeBytes, relativePath);

    let item = await this.items.findOne({ libraryId: library._id, relativePath });
    if (!item && sizeBytes > 0) {
      const duplicate = await this.items.findOne({ libraryId: library._id, contentHash });
      if (duplicate) {
        scan.duplicates += 1;
        await this.log(
          scan,
          LibraryLogLevel.Warn,
          `Skipped duplicate ${fileName} (same content as an existing item).`,
          duplicate.storageKey,
        );
        return;
      }
    }

    if (!item) {
      try {
        item = await this.items.create({
          libraryId: library._id,
          storageKey: newStorageKey(),
          relativePath,
          fileKind,
          contentHash,
          sizeBytes,
          mtimeMs,
          status: LibraryItemStatus.Processing,
          match: LibraryMatchType.None,
        });
      } catch (error) {
        const code =
          typeof error === 'object' && error && 'code' in error ? Number((error as { code: unknown }).code) : 0;
        if (code === 11000) {
          scan.duplicates += 1;
          await this.log(scan, LibraryLogLevel.Warn, `Skipped duplicate ${fileName}.`);
          return;
        }
        throw error;
      }
    } else if (sizeBytes > 0) {
      const hashClash = await this.items.findOne({
        libraryId: library._id,
        contentHash,
        _id: { $ne: item._id },
      });
      if (hashClash) {
        item.status = LibraryItemStatus.Duplicate;
        item.duplicateOf = hashClash.storageKey;
        item.lastScanId = scan._id;
        item.lastSeenAt = new Date();
        item.sizeBytes = sizeBytes;
        item.mtimeMs = mtimeMs;
        await item.save();
        scan.duplicates += 1;
        await this.log(scan, LibraryLogLevel.Warn, `Duplicate content at ${fileName}.`, item.storageKey);
        return;
      }
    }

    const unchanged =
      !scan.full &&
      item.sizeBytes === sizeBytes &&
      item.mtimeMs === mtimeMs &&
      item.contentHash === contentHash &&
      Boolean(item.probe);

    item.contentHash = contentHash;
    item.sizeBytes = sizeBytes;
    item.mtimeMs = mtimeMs;
    item.fileKind = fileKind;
    item.lastScanId = scan._id;
    item.lastSeenAt = new Date();
    item.missingSince = null;
    item.status = LibraryItemStatus.Processing;
    if (!unchanged) {
      item.probe = await this.probe.probe(absPath, fileName, sizeBytes);
    }
    await item.save();

    const matched = await this.importer.resolve(relativePath, library.kind as LibraryKind, {
      libraryId: String(library._id),
      libraryRoot: library.rootPath,
      fileKind,
      durationMs: item.probe?.durationMs,
      contentHash: item.contentHash,
      ignored: Boolean(item.ignored),
      existingMovieId: item.movieId ? String(item.movieId) : null,
      existingSeriesId: item.seriesId ? String(item.seriesId) : null,
      existingSeasonId: item.seasonId ? String(item.seasonId) : null,
      existingEpisodeId: item.episodeId ? String(item.episodeId) : null,
    });
    await this.applyMatch(scan, item, fileName, matched);
  }

  private async rematchSidecars(scan: LibraryScanDocument, library: MediaLibraryDocument): Promise<void> {
    const unmatched = await this.items.find({
      libraryId: library._id,
      lastScanId: scan._id,
      status: LibraryItemStatus.Unmatched,
      fileKind: { $in: [LibraryFileKind.Audio, LibraryFileKind.Subtitle] },
    });
    for (const item of unmatched) {
      if (await this.isCancelled(String(scan._id))) {
        return;
      }
      const fileName = path.posix.basename(item.relativePath.replace(/\\/g, '/'));
      const matched = await this.importer.resolve(item.relativePath, library.kind as LibraryKind, {
        libraryId: String(library._id),
        libraryRoot: library.rootPath,
        fileKind: item.fileKind,
        durationMs: item.probe?.durationMs,
        contentHash: item.contentHash,
        ignored: Boolean(item.ignored),
        existingMovieId: item.movieId ? String(item.movieId) : null,
        existingSeriesId: item.seriesId ? String(item.seriesId) : null,
        existingSeasonId: item.seasonId ? String(item.seasonId) : null,
        existingEpisodeId: item.episodeId ? String(item.episodeId) : null,
      });
      if (matched.match === LibraryMatchType.None) {
        continue;
      }
      await this.applyMatch(scan, item, fileName, matched);
    }
  }

  private async applyMatch(
    scan: LibraryScanDocument,
    item: LibraryItemDocument,
    fileName: string,
    matched: Awaited<ReturnType<LibraryImportService['resolve']>>,
  ): Promise<void> {
    item.match = matched.match;
    item.movieId = matched.movieId ?? null;
    item.seriesId = matched.seriesId ?? null;
    item.seasonId = matched.seasonId ?? null;
    item.episodeId = matched.episodeId ?? null;
    item.matchTitle = matched.matchTitle ?? null;

    if (matched.match === LibraryMatchType.None) {
      if (matched.ignored) {
        item.ignored = true;
      }
      item.status = LibraryItemStatus.Unmatched;
      await item.save();
      await this.log(
        scan,
        LibraryLogLevel.Info,
        item.ignored ? `Ignored ${fileName} (removed from catalog).` : `Unmatched ${fileName}.`,
        item.storageKey,
      );
      return;
    }

    item.ignored = false;

    await this.upsertAssets(item);
    item.status = LibraryItemStatus.Ready;
    await item.save();
    scan.matched += 1;
    await this.log(scan, LibraryLogLevel.Info, `Matched ${fileName} → ${item.matchTitle}.`, item.storageKey);
    if (item.movieId) await this.libraries.refreshMovieAvailability(item.movieId);
    if (item.episodeId) await this.libraries.refreshEpisodeAvailability(item.episodeId);
  }

  private async upsertAssets(item: LibraryItemDocument): Promise<void> {
    const probe = item.probe;
    const quality = probe?.resolution ?? null;
    const owner = {
      movieId: item.movieId ?? null,
      episodeId: item.episodeId ?? null,
      libraryItemId: item._id,
    };
    const fileName = item.relativePath.split(/[\\/]/).pop() ?? item.relativePath;
    const language = detectLanguageHint(fileName) ?? probe?.subtitleTracks?.[0]?.language ?? probe?.audioTracks?.[0]?.language ?? null;

    if (item.fileKind === LibraryFileKind.Subtitle) {
      await this.upsertSidecar(item, owner, {
        kind: MediaKind.Subtitle,
        language: language ?? 'en',
        format: subtitleFormatFromName(fileName),
        codec: subtitleFormatFromName(fileName) === 'srt' ? 'subrip' : subtitleFormatFromName(fileName) === 'vtt' ? 'webvtt' : probe?.subtitleTracks?.[0]?.codec ?? null,
        label: languageLabel(language ?? 'en'),
      });
      return;
    }

    if (item.fileKind === LibraryFileKind.Audio) {
      await this.upsertSidecar(item, owner, {
        kind: MediaKind.Audio,
        language: language ?? probe?.audioTracks?.[0]?.language ?? 'en',
        codec: probe?.audioCodec ?? probe?.audioTracks?.[0]?.codec ?? 'aac',
        channels: probe?.audioTracks?.[0]?.channels ?? 2,
        bitrateKbps: probe?.audioTracks?.[0]?.bitrateKbps ?? null,
        label: languageLabel(language ?? 'en'),
      });
      return;
    }

    const videoKind = MediaKind.Video;
    let asset: MediaAssetDocument | null = await this.assets
      .findOne({ libraryItemId: item._id, kind: videoKind })
      .select('+storagePath');
    if (!asset) {
      asset = await this.assets.findOne({ storageKey: item.storageKey }).select('+storagePath');
    }
    const defaultCount = await this.assets.countDocuments({
      ...(item.movieId ? { movieId: item.movieId } : { episodeId: item.episodeId }),
      kind: videoKind,
    });
    if (!asset) {
      await this.assets.create({
        ...owner,
        kind: MediaKind.Video,
        storageKey: item.storageKey,
        storagePath: item.relativePath,
        quality,
        codec: probe?.videoCodec ?? null,
        language: null,
        bitrateKbps: probe?.bitrateKbps ?? null,
        channels: probe?.audioTracks?.[0]?.channels ?? null,
        isDefault: defaultCount === 0,
        status: MediaAssetStatus.Ready,
      });
    } else {
      asset.movieId = owner.movieId;
      asset.episodeId = owner.episodeId;
      asset.libraryItemId = item._id;
      asset.storagePath = item.relativePath;
      asset.kind = MediaKind.Video;
      asset.quality = quality;
      asset.codec = probe?.videoCodec ?? asset.codec;
      asset.bitrateKbps = probe?.bitrateKbps ?? asset.bitrateKbps;
      asset.channels = probe?.audioTracks?.[0]?.channels ?? asset.channels;
      asset.status = MediaAssetStatus.Ready;
      await asset.save();
    }

    if (!probe) {
      return;
    }
    for (const [index, track] of probe.audioTracks.entries()) {
      const storageKey = `${item.storageKey}-a${index}`;
      await this.assets.findOneAndUpdate(
        { storageKey },
        {
          $set: {
            ...owner,
            kind: MediaKind.Audio,
            storageKey,
            language: asProfileLanguage(track.language) ?? track.language,
            codec: track.codec,
            channels: track.channels,
            bitrateKbps: track.bitrateKbps,
            label: track.label ?? languageLabel(track.language),
            status: MediaAssetStatus.Ready,
            sortOrder: index,
          },
          $setOnInsert: { isDefault: index === 0 },
        },
        { upsert: true },
      );
    }
    for (const [index, track] of probe.subtitleTracks.entries()) {
      const storageKey = `${item.storageKey}-s${index}`;
      await this.assets.findOneAndUpdate(
        { storageKey },
        {
          $set: {
            ...owner,
            kind: MediaKind.Subtitle,
            storageKey,
            language: asProfileLanguage(track.language) ?? track.language,
            codec: track.codec,
            format:
              track.codec === 'subrip' || track.codec === 'srt'
                ? 'srt'
                : track.codec === 'webvtt' || track.codec === 'wvtt'
                  ? 'vtt'
                  : null,
            forced: track.forced,
            hearingImpaired: track.hearingImpaired,
            label: languageLabel(track.language),
            status: MediaAssetStatus.Ready,
            sortOrder: index,
          },
          $setOnInsert: { isDefault: index === 0 },
        },
        { upsert: true },
      );
    }
  }

  private async upsertSidecar(
    item: LibraryItemDocument,
    owner: { movieId: Types.ObjectId | null; episodeId: Types.ObjectId | null; libraryItemId: Types.ObjectId },
    fields: {
      kind: MediaKind;
      language: string;
      codec?: string | null;
      channels?: number | null;
      bitrateKbps?: number | null;
      format?: SubtitleFormat | null;
      label: string;
    },
  ): Promise<void> {
    const existing =
      (await this.assets.findOne({ libraryItemId: item._id, kind: fields.kind }).select('+storagePath')) ??
      (await this.assets.findOne({ storageKey: item.storageKey }).select('+storagePath'));
    const defaultCount = await this.assets.countDocuments({
      ...(item.movieId ? { movieId: item.movieId } : { episodeId: item.episodeId }),
      kind: fields.kind,
    });
    const payload = {
      ...owner,
      kind: fields.kind,
      storageKey: existing?.storageKey ?? item.storageKey,
      storagePath: item.relativePath,
      language: fields.language,
      codec: fields.codec ?? null,
      channels: fields.channels ?? null,
      bitrateKbps: fields.bitrateKbps ?? null,
      format: fields.format ?? null,
      label: fields.label,
      status: MediaAssetStatus.Ready,
    };
    if (!existing) {
      await this.assets.create({
        ...payload,
        isDefault: defaultCount === 0,
      });
      return;
    }
    existing.set(payload);
    await existing.save();
  }

  private async markMissing(scan: LibraryScanDocument, library: MediaLibraryDocument): Promise<void> {
    const missing = await this.items.find({
      libraryId: library._id,
      lastScanId: { $ne: scan._id },
      status: { $nin: [LibraryItemStatus.Duplicate] },
    });
    const movieIds = new Set<string>();
    const episodeIds = new Set<string>();
    for (const item of missing) {
      item.status = LibraryItemStatus.Missing;
      item.missingSince = item.missingSince ?? new Date();
      await item.save();
      await this.assets.updateMany({ libraryItemId: item._id }, { $set: { status: MediaAssetStatus.Missing } });
      if (item.movieId) {
        const id = String(item.movieId);
        movieIds.add(id);
        await this.libraries.refreshMovieAvailability(item.movieId);
      }
      if (item.episodeId) {
        const id = String(item.episodeId);
        episodeIds.add(id);
        await this.libraries.refreshEpisodeAvailability(item.episodeId);
      }
      await this.log(
        scan,
        LibraryLogLevel.Warn,
        `Missing ${path.posix.basename(item.relativePath.replace(/\\/g, '/'))}.`,
        item.storageKey,
      );
    }
    for (const movieId of movieIds) {
      const purged = await this.libraries.purgeMovieIfUnplayable(new Types.ObjectId(movieId));
      if (purged) {
        await this.log(scan, LibraryLogLevel.Info, `Removed catalog movie with no remaining media (${movieId}).`);
      }
    }
    for (const episodeId of episodeIds) {
      const purged = await this.libraries.purgeEpisodeIfUnplayable(new Types.ObjectId(episodeId));
      if (purged) {
        await this.log(scan, LibraryLogLevel.Info, `Removed catalog episode with no remaining media (${episodeId}).`);
      }
    }
    scan.missing += missing.length;
  }

  private async log(
    scan: LibraryScanDocument,
    level: LibraryLogLevel,
    message: string,
    storageKey?: string | null,
  ): Promise<void> {
    let roots = this.scanLogRoots;
    if (roots.length === 0) {
      roots = (await this.libraryModel.find().select('+rootPath'))
        .map((item) => item.rootPath)
        .filter((root): root is string => Boolean(root));
    }
    await this.logs.create({
      scanId: scan._id,
      level,
      message: sanitizeScanMessage(message, roots),
      storageKey: storageKey ?? null,
    });
  }

  private async progress(scan: LibraryScanDocument): Promise<void> {
    await this.redis.client.set(this.progressKey(String(scan._id)), JSON.stringify(toAdminScan(scan)), 'PX', LOCK_MS);
  }

  private async isCancelled(scanId: string): Promise<boolean> {
    const flag = await this.redis.client.get(this.cancelKey(scanId));
    return flag === '1';
  }

  private cancelKey(scanId: string): string {
    return `library:scan:${scanId}:cancel`;
  }

  private progressKey(scanId: string): string {
    return `library:scan:${scanId}:progress`;
  }

  private async requireScan(id: string): Promise<LibraryScanDocument> {
    const scan = await this.scans.findById(id);
    if (!scan) {
      throw new NotFoundException({
        error: ErrorCode.ScanNotFound,
        message: 'Library scan not found.',
      });
    }
    return scan;
  }
}
