import { VideoResolution } from './movie';

export const LibraryKind = {
  Movies: 'movies',
  Tv: 'tv',
} as const;

export type LibraryKind = (typeof LibraryKind)[keyof typeof LibraryKind];
export const LIBRARY_KINDS = [LibraryKind.Movies, LibraryKind.Tv] as const;

export const StorageProviderKind = {
  Local: 'local',
  S3: 's3',
  Smb: 'smb',
} as const;

export type StorageProviderKind = (typeof StorageProviderKind)[keyof typeof StorageProviderKind];
export const STORAGE_PROVIDER_KINDS = [
  StorageProviderKind.Local,
  StorageProviderKind.S3,
  StorageProviderKind.Smb,
] as const;

export const LibraryFileKind = {
  Video: 'video',
  Audio: 'audio',
  Subtitle: 'subtitle',
  Other: 'other',
} as const;

export type LibraryFileKind = (typeof LibraryFileKind)[keyof typeof LibraryFileKind];
export const LIBRARY_FILE_KINDS = [
  LibraryFileKind.Video,
  LibraryFileKind.Audio,
  LibraryFileKind.Subtitle,
  LibraryFileKind.Other,
] as const;

export const LibraryItemStatus = {
  Ready: 'ready',
  Missing: 'missing',
  Unmatched: 'unmatched',
  Error: 'error',
  Processing: 'processing',
  Duplicate: 'duplicate',
} as const;

export type LibraryItemStatus = (typeof LibraryItemStatus)[keyof typeof LibraryItemStatus];
export const LIBRARY_ITEM_STATUSES = [
  LibraryItemStatus.Ready,
  LibraryItemStatus.Missing,
  LibraryItemStatus.Unmatched,
  LibraryItemStatus.Error,
  LibraryItemStatus.Processing,
  LibraryItemStatus.Duplicate,
] as const;

export const LibraryMatchType = {
  Movie: 'movie',
  Episode: 'episode',
  None: 'none',
} as const;

export type LibraryMatchType = (typeof LibraryMatchType)[keyof typeof LibraryMatchType];
export const LIBRARY_MATCH_TYPES = [
  LibraryMatchType.Movie,
  LibraryMatchType.Episode,
  LibraryMatchType.None,
] as const;

export const LibraryScanStatus = {
  Queued: 'queued',
  Running: 'running',
  Completed: 'completed',
  Failed: 'failed',
  Cancelled: 'cancelled',
} as const;

export type LibraryScanStatus = (typeof LibraryScanStatus)[keyof typeof LibraryScanStatus];
export const LIBRARY_SCAN_STATUSES = [
  LibraryScanStatus.Queued,
  LibraryScanStatus.Running,
  LibraryScanStatus.Completed,
  LibraryScanStatus.Failed,
  LibraryScanStatus.Cancelled,
] as const;

export const LibraryLogLevel = {
  Info: 'info',
  Warn: 'warn',
  Error: 'error',
} as const;

export type LibraryLogLevel = (typeof LibraryLogLevel)[keyof typeof LibraryLogLevel];
export const LIBRARY_LOG_LEVELS = [
  LibraryLogLevel.Info,
  LibraryLogLevel.Warn,
  LibraryLogLevel.Error,
] as const;

export type ProbeAudioTrack = {
  index: number;
  codec: string | null;
  language: string | null;
  channels: number | null;
  bitrateKbps: number | null;
  label: string | null;
};

export type ProbeSubtitleTrack = {
  index: number;
  codec: string | null;
  language: string | null;
  forced: boolean;
  hearingImpaired: boolean;
};

export type ProbeVideoStream = {
  index: number;
  codec: string | null;
  width: number | null;
  height: number | null;
  bitrateKbps: number | null;
  fps: number | null;
};

export type LibraryProbe = {
  durationMs: number | null;
  width: number | null;
  height: number | null;
  resolution: VideoResolution | null;
  videoCodec: string | null;
  audioCodec: string | null;
  bitrateKbps: number | null;
  sizeBytes: number;
  videoStreams: ProbeVideoStream[];
  audioTracks: ProbeAudioTrack[];
  subtitleTracks: ProbeSubtitleTrack[];
};

export type AdminLibrary = {
  id: string;
  name: string;
  kind: LibraryKind;
  provider: StorageProviderKind;
  enabled: boolean;
  rootLabel: string;
  imageUrl: string | null;
  smbServerId: string | null;
  smbShare: string | null;
  smbRemotePath: string | null;
  itemCount: number;
  readyCount: number;
  missingCount: number;
  unmatchedCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminLibraryItem = {
  id: string;
  libraryId: string;
  storageKey: string;
  fileName: string;
  displayPath: string;
  fileKind: LibraryFileKind;
  status: LibraryItemStatus;
  match: LibraryMatchType;
  movieId: string | null;
  seriesId: string | null;
  seasonId: string | null;
  episodeId: string | null;
  matchTitle: string | null;
  probe: LibraryProbe | null;
  duplicateOf: string | null;
  sizeBytes: number;
  lastSeenAt: string | null;
  missingSince: string | null;
  ignored: boolean;
};

export type AdminLibraryScan = {
  id: string;
  libraryId: string | null;
  status: LibraryScanStatus;
  full: boolean;
  processed: number;
  total: number;
  discovered: number;
  matched: number;
  missing: number;
  errors: number;
  duplicates: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
};

export type AdminLibraryScanLog = {
  id: string;
  scanId: string;
  level: LibraryLogLevel;
  message: string;
  storageKey: string | null;
  createdAt: string;
};

export type AdminLibrariesResponse = {
  libraries: AdminLibrary[];
};

export type AdminLibraryResponse = {
  library: AdminLibrary;
};

export type AdminLibraryItemsResponse = {
  items: AdminLibraryItem[];
  total: number;
  page: number;
  limit: number;
};

export type AdminLibraryScansResponse = {
  scans: AdminLibraryScan[];
};

export type AdminLibraryScanResponse = {
  scan: AdminLibraryScan;
};

export type AdminLibraryScanLogsResponse = {
  logs: AdminLibraryScanLog[];
};
