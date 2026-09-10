import type { PublicPlaybackSession } from '@movie-server/shared';
import type { StoredPlaybackSession } from './playback-session.types';

export function toPublicPlayback(item: StoredPlaybackSession): PublicPlaybackSession {
  return {
    id: item.id,
    profileId: item.profileId,
    deviceKey: item.deviceId,
    deviceName: item.deviceLabel ?? null,
    mediaType: item.mediaType,
    mediaId: item.mediaId,
    quality: item.quality,
    startedAt: new Date(item.createdAt).toISOString(),
    lastHeartbeatAt: new Date(item.lastHeartbeat).toISOString(),
  };
}
