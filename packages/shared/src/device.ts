export const DeviceType = {
  Browser: 'browser',
  Desktop: 'desktop',
  Mobile: 'mobile',
  Tablet: 'tablet',
  Tv: 'tv',
  App: 'app',
  Unknown: 'unknown',
} as const;

export type DeviceType = (typeof DeviceType)[keyof typeof DeviceType];
export const DEVICE_TYPES = [
  DeviceType.Browser,
  DeviceType.Desktop,
  DeviceType.Mobile,
  DeviceType.Tablet,
  DeviceType.Tv,
  DeviceType.App,
  DeviceType.Unknown,
] as const;

export const SuspiciousReason = {
  ConcurrentIps: 'concurrent_ips',
  RapidIpChange: 'rapid_ip_change',
  RefreshReuse: 'refresh_reuse',
  ManyDevices: 'many_devices_short_window',
} as const;

export type SuspiciousReason = (typeof SuspiciousReason)[keyof typeof SuspiciousReason];
export const SUSPICIOUS_REASONS = [
  SuspiciousReason.ConcurrentIps,
  SuspiciousReason.RapidIpChange,
  SuspiciousReason.RefreshReuse,
  SuspiciousReason.ManyDevices,
] as const;

export type PublicDevice = {
  id: string;
  name: string;
  type: DeviceType;
  platform: string | null;
  browser: string | null;
  userAgent: string;
  ip: string;
  lastActiveAt: string;
  firstSeenAt: string;
  current: boolean;
  countsTowardLimit: boolean;
  playing: boolean;
  suspicious: boolean;
  flags: string[];
};

export type PublicAuthSession = {
  id: string;
  deviceId: string | null;
  deviceName: string | null;
  deviceType: DeviceType | null;
  browser: string | null;
  userAgent: string;
  ip: string;
  current: boolean;
  lastActiveAt: string;
  createdAt: string;
  expiresAt: string;
  suspicious: boolean;
  flags: string[];
};

export type PublicPlaybackSession = {
  id: string;
  profileId: string;
  deviceKey: string;
  deviceName: string | null;
  mediaType: 'movie' | 'episode';
  mediaId: string;
  quality: string;
  startedAt: string;
  lastHeartbeatAt: string;
};

export type DeviceSecurityOverview = {
  devices: PublicDevice[];
  sessions: PublicAuthSession[];
  streams: PublicPlaybackSession[];
  maxDevices: number;
  maxStreams: number;
  deviceCount: number;
  streamCount: number;
};

export type AdminAuthSession = PublicAuthSession & {
  userId: string;
  userEmail: string;
};

export type AdminPlaybackSession = PublicPlaybackSession & {
  userId: string;
  userEmail: string;
};

export type AdminSessionMonitor = {
  sessions: AdminAuthSession[];
  streams: AdminPlaybackSession[];
  suspicious: AdminAuthSession[];
};
