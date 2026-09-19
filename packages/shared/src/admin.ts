import type { HomeMediaKind, HomeRowKind } from './home';
import type { MediaAssetStatus, MediaKind, SubtitleFormat, VideoResolution } from './movie';
import type { PublicProfile } from './profile';
import type { UserRole } from './user';

export type AdminPage<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type AdminDashboard = {
  users: { total: number; active: number; admins: number };
  profiles: number;
  catalog: { movies: number; series: number; seasons: number; episodes: number };
  subscriptions: { active: number; trial: number; suspended: number; canceled: number };
  billing: { successfulPayments: number; refunded: number };
  library: { libraries: number; unmatched: number; missing: number };
  live: { sessions: number; streams: number };
  scans: { running: number; lastStatus: string | null; lastCompletedAt: string | null };
  movieUploadRequests: { enabled: boolean; pending: number };
};

export type AdminHealth = {
  status: 'ok' | 'degraded';
  mongo: 'up' | 'down';
  redis: 'up' | 'down';
  queues: { enabled: boolean; names: string[] };
  uptimeSeconds: number;
};

export type AdminQueueStats = {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
};

export type AdminJobRecord = {
  id: string;
  queue: string;
  name: string;
  status: string;
  progress: number | null;
  createdAt: string;
  finishedAt: string | null;
  failedReason: string | null;
};

export type AdminJobsResponse = {
  enabled: boolean;
  queues: AdminQueueStats[];
  recent: AdminJobRecord[];
};

export type AdminAuditLog = {
  id: string;
  actorUserId: string;
  actorEmail: string;
  actorRole: UserRole;
  method: string;
  path: string;
  action: string;
  resource: string | null;
  resourceId: string | null;
  statusCode: number;
  ip: string;
  userAgent: string;
  createdAt: string;
};

export const CatalogTermKind = {
  Genre: 'genre',
  Tag: 'tag',
} as const;
export type CatalogTermKind = (typeof CatalogTermKind)[keyof typeof CatalogTermKind];
export const CATALOG_TERM_KINDS = [CatalogTermKind.Genre, CatalogTermKind.Tag] as const;

export type AdminCatalogTerm = {
  id: string;
  kind: CatalogTermKind;
  slug: string;
  name: string;
  enabled: boolean;
  sortOrder: number;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminHomeHero = {
  id: string;
  enabled: boolean;
  mediaKind: HomeMediaKind | null;
  mediaId: string | null;
  titleOverride: string | null;
  /** Ordered slider titles (max 6). */
  itemIds: string[];
  updatedAt: string;
};

export type AdminHomeRow = {
  id: string;
  title: string;
  kind: HomeRowKind;
  enabled: boolean;
  /** When true, shelf titles are picked and ordered randomly on each home load. */
  shuffleItems: boolean;
  sortOrder: number;
  genre: string | null;
  collectionId: string | null;
  libraryId: string | null;
  itemIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type AdminProfileRow = PublicProfile & {
  userEmail: string;
  userDisplayName: string;
};

export type AdminTrackRow = {
  id: string;
  kind: MediaKind;
  movieId: string | null;
  episodeId: string | null;
  label: string | null;
  language: string | null;
  quality: VideoResolution | null;
  format: SubtitleFormat | null;
  codec: string | null;
  channels: number | null;
  status: MediaAssetStatus;
  isDefault: boolean;
  createdAt: string;
};

export type AdminUserSubscriptionSummary = {
  id: string;
  status: string;
  planSlug: string;
  planName: string;
  billingCycle: string;
  entitled: boolean;
  currentPeriodEnd: string;
};

/** Per-user subscription admin rule overrides (null = inherit staff profile). */
export type AdminUserSubscriptionRules = {
  view: boolean | null;
  manage: boolean | null;
};

export type AdminUserRow = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  staffProfileId: string | null;
  emailVerified: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  subscription: AdminUserSubscriptionSummary | null;
  subscriptionRules: AdminUserSubscriptionRules | null;
};
