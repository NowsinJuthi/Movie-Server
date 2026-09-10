import { PublicMovie, SubtitleFormat, VideoResolution } from './movie';
import { WatchProgress } from './profile';
import { VideoQuality } from './subscription';

export type PlaybackMarkers = {
  introStartSeconds: number | null;
  introEndSeconds: number | null;
  recapStartSeconds: number | null;
  recapEndSeconds: number | null;
  creditsStartSeconds: number | null;
};

export const emptyPlaybackMarkers = (): PlaybackMarkers => ({
  introStartSeconds: null,
  introEndSeconds: null,
  recapStartSeconds: null,
  recapEndSeconds: null,
  creditsStartSeconds: null,
});

export type PlaybackQualityOption = {
  resolution: VideoResolution;
  quality: VideoQuality;
  bandwidth: number;
  label: string;
  allowed: boolean;
};

export type PlaybackTrackKind = 'audio' | 'subtitle';

export type PlaybackTrack = {
  id: string;
  kind: PlaybackTrackKind;
  language: string | null;
  languageLabel: string;
  label: string;
  codec: string | null;
  channels: number | null;
  format: SubtitleFormat | null;
  forced: boolean;
  hearingImpaired: boolean;
  isDefault: boolean;
  playable: boolean;
  /** True when the track lives inside the video file (dual-audio MKV/MP4). */
  embedded: boolean;
  /** Demuxer audio stream index for embedded tracks. */
  streamIndex: number | null;
  url: string | null;
};

export type PlaybackSessionInfo = {
  id: string;
  protocol: 'hls';
  hlsUrl: string;
  progressiveUrl: string;
  expiresAt: string;
  qualities: PlaybackQualityOption[];
  selectedQuality: VideoQuality;
  selectedResolution: VideoResolution | null;
  adaptive: boolean;
  audioTracks: PlaybackTrack[];
  subtitleTracks: PlaybackTrack[];
  selectedAudioId: string | null;
  selectedSubtitleId: string | null;
};

export type MoviePlaybackResponse = {
  allowed: boolean;
  quality: VideoQuality;
  movie: PublicMovie;
  session: PlaybackSessionInfo | null;
  markers: PlaybackMarkers;
  resumeSeconds: number;
  progress: WatchProgress | null;
};

export type MovieProgressResponse = {
  movie: PublicMovie;
  progress: WatchProgress;
};

export type MovieContinueItem = {
  movie: PublicMovie;
  progress: WatchProgress;
};
