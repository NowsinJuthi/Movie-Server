import path from 'path';
import {
  AdminLibrary,
  AdminLibraryItem,
  AdminLibraryScan,
  AdminLibraryScanLog,
  LibraryFileKind,
  LibraryItemStatus,
  LibraryKind,
  LibraryMatchType,
  LibraryProbe,
  StorageProviderKind,
} from '@movie-server/shared';
import { looksLikeFilesystemPath } from '../movies/movie.util';
import { artworkPublicPath } from '../movies/movie.util';
import { MediaLibraryDocument } from './schemas/media-library.schema';
import { LibraryItemDocument } from './schemas/library-item.schema';
import { LibraryScanDocument } from './schemas/library-scan.schema';
import { LibraryScanLogDocument } from './schemas/library-scan-log.schema';

function iso(value?: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function libraryImageUrl(library: MediaLibraryDocument): string | null {
  if (library.imageKey) {
    return artworkPublicPath(library.imageKey);
  }
  return library.imageUrl ?? null;
}

export function rootLabel(rootPath: string): string {
  const base = path.basename(rootPath.replace(/[\\/]+$/, ''));
  return base || 'library';
}

export function toDisplayPath(relativePath: string): string {
  const posix = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!posix || posix.includes('..') || looksLikeFilesystemPath(posix) || looksLikeFilesystemPath(relativePath)) {
    return posix.split('/').filter(Boolean).pop() ?? 'media';
  }
  return posix;
}

export function toAdminLibrary(
  library: MediaLibraryDocument,
  counts?: { itemCount: number; readyCount: number; missingCount: number; unmatchedCount: number },
  rootPath?: string,
): AdminLibrary {
  const hiddenRoot = rootPath ?? (library as unknown as { rootPath?: string }).rootPath ?? '';
  return {
    id: String(library._id),
    name: library.name,
    kind: library.kind as LibraryKind,
    provider: library.provider as StorageProviderKind,
    enabled: library.enabled,
    rootLabel: rootLabel(hiddenRoot),
    imageUrl: libraryImageUrl(library),
    smbServerId: library.smbServerId ? String(library.smbServerId) : null,
    smbShare: library.smbShare ?? null,
    smbRemotePath: library.smbRemotePath ?? null,
    itemCount: counts?.itemCount ?? 0,
    readyCount: counts?.readyCount ?? 0,
    missingCount: counts?.missingCount ?? 0,
    unmatchedCount: counts?.unmatchedCount ?? 0,
    createdAt: library.createdAt.toISOString(),
    updatedAt: library.updatedAt.toISOString(),
  };
}

export function toAdminLibraryItem(item: LibraryItemDocument): AdminLibraryItem {
  const relative = item.relativePath;
  return {
    id: String(item._id),
    libraryId: String(item.libraryId),
    storageKey: item.storageKey,
    fileName: path.posix.basename(relative.replace(/\\/g, '/')),
    displayPath: toDisplayPath(relative),
    fileKind: item.fileKind as LibraryFileKind,
    status: item.status as LibraryItemStatus,
    match: item.match as LibraryMatchType,
    movieId: item.movieId ? String(item.movieId) : null,
    seriesId: item.seriesId ? String(item.seriesId) : null,
    seasonId: item.seasonId ? String(item.seasonId) : null,
    episodeId: item.episodeId ? String(item.episodeId) : null,
    matchTitle: item.matchTitle ?? null,
    probe: (item.probe as LibraryProbe | null) ?? null,
    duplicateOf: item.duplicateOf ?? null,
    sizeBytes: item.sizeBytes,
    lastSeenAt: iso(item.lastSeenAt),
    missingSince: iso(item.missingSince),
    ignored: Boolean(item.ignored),
  };
}

export function toAdminScan(scan: LibraryScanDocument): AdminLibraryScan {
  return {
    id: String(scan._id),
    libraryId: scan.libraryId ? String(scan.libraryId) : null,
    status: scan.status,
    full: scan.full,
    processed: scan.processed,
    total: scan.total,
    discovered: scan.discovered,
    matched: scan.matched,
    missing: scan.missing,
    errors: scan.errorCount,
    duplicates: scan.duplicates,
    startedAt: iso(scan.startedAt),
    finishedAt: iso(scan.finishedAt),
    createdAt: scan.createdAt.toISOString(),
  };
}

export function toAdminLog(log: LibraryScanLogDocument): AdminLibraryScanLog {
  return {
    id: String(log._id),
    scanId: String(log.scanId),
    level: log.level,
    message: log.message,
    storageKey: log.storageKey ?? null,
    createdAt: log.createdAt.toISOString(),
  };
}
