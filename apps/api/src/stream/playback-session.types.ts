import { SubtitleFormat, VideoQuality, VideoResolution } from '@movie-server/shared';

export type StoredPlaybackVariant = {
  assetId: string;
  resolution: VideoResolution;
  quality: VideoQuality;
  bandwidth: number;
};

export type StoredPlaybackTrack = {
  assetId: string;
  kind: 'audio' | 'subtitle';
  language: string | null;
  label: string | null;
  codec: string | null;
  channels: number | null;
  format: SubtitleFormat | null;
  forced: boolean;
  hearingImpaired: boolean;
  isDefault: boolean;
  playable: boolean;
  embedded: boolean;
  streamIndex: number | null;
};

export type StoredPlaybackSession = {
  id: string;
  userId: string;
  profileId: string;
  deviceId: string;
  mediaType: 'movie' | 'episode';
  mediaId: string;
  movieId?: string;
  episodeId?: string;
  seriesId?: string;
  assetId: string;
  quality: VideoQuality;
  resolution: VideoResolution | null;
  variants: StoredPlaybackVariant[];
  audioTracks: StoredPlaybackTrack[];
  subtitleTracks: StoredPlaybackTrack[];
  selectedAudioId: string | null;
  selectedSubtitleId: string | null;
  durationSeconds: number;
  /** Cached at session open — avoids re-probing the file on every byte-range request. */
  videoRemux: boolean;
  /** Cached at session open — HEVC/EAC3 titles need live HLS transcode + seek restart. */
  videoTranscode: boolean;
  /** Re-encode video stream (HEVC). False when only audio needs conversion. */
  transcodeEncodeVideo: boolean;
  /** Re-encode audio stream (EAC3/DTS). */
  transcodeEncodeAudio: boolean;
  /** Preferred embedded audio stream for live transcode (cached from ffprobe). */
  transcodeAudioOrdinal: number;
  /** Cached video codec from library probe (h264, hevc, …). */
  sourceVideoCodec: string | null;
  /** Query token for <video src> on iOS Safari (cookies are not sent on media requests). */
  mediaToken: string;
  createdAt: number;
  lastHeartbeat: number;
  deviceLabel?: string;
};

export const STREAM_PREFIX = 'stream:session:';
export const STREAM_USER_PREFIX = 'stream:user:';
export const STREAM_DEVICE_PREFIX = 'stream:devices:';
