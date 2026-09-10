import {
  PLAYABLE_SUBTITLE_FORMATS,
  SubtitleFormat,
  asProfileLanguage,
  languageLabel,
  type PlaybackTrack,
  type SubtitleLanguage,
} from '@movie-server/shared';
import { StoredPlaybackTrack } from './playback-session.types';

const API = '/api/v1';

export function pickStoredTrack(
  tracks: StoredPlaybackTrack[],
  preferred?: string | null,
  allowOff = false,
): StoredPlaybackTrack | null {
  if (allowOff && (!preferred || preferred === 'off')) {
    return null;
  }
  const wanted = asProfileLanguage(preferred) ?? preferred ?? null;
  const matching = wanted
    ? tracks.filter((track) => (asProfileLanguage(track.language) ?? track.language) === wanted)
    : [];
  return (
    matching.find((track) => track.playable) ??
    matching[0] ??
    tracks.find((track) => track.isDefault && track.playable) ??
    tracks.find((track) => track.playable) ??
    tracks.find((track) => track.isDefault) ??
    tracks[0] ??
    null
  );
}

export function toPlaybackTrack(sessionId: string, track: StoredPlaybackTrack): PlaybackTrack {
  const sidecarPlayable = track.playable && (track.kind === 'audio' || isPlayableSubtitle(track.format));
  // Embedded alternate audio (streamIndex > 0) is extracted on demand via FFmpeg.
  const embeddedAlternate =
    track.kind === 'audio' && track.embedded && track.streamIndex != null && track.streamIndex > 0;
  const playable =
    track.kind === 'audio' ? sidecarPlayable || track.embedded : sidecarPlayable;
  const path =
    track.kind === 'audio'
      ? `${API}/stream/${sessionId}/audio/${track.assetId}`
      : `${API}/stream/${sessionId}/subtitles/${track.assetId}`;
  const fallbackLabel =
    track.kind === 'audio' ? languageLabel(track.language) : `${languageLabel(track.language)} subtitles`;
  return {
    id: track.assetId,
    kind: track.kind,
    language: track.language,
    languageLabel: languageLabel(track.language),
    label: track.label?.trim() || fallbackLabel,
    codec: track.codec,
    channels: track.channels,
    format: track.format,
    forced: track.forced,
    hearingImpaired: track.hearingImpaired,
    isDefault: track.isDefault,
    playable,
    embedded: Boolean(track.embedded),
    streamIndex: track.streamIndex ?? null,
    url: sidecarPlayable || embeddedAlternate ? path : null,
  };
}

export function isPlayableSubtitle(format?: SubtitleFormat | null): boolean {
  return Boolean(format && (PLAYABLE_SUBTITLE_FORMATS as readonly string[]).includes(format));
}

export function preferredSubtitleCode(value?: SubtitleLanguage | string | null): string | null {
  if (!value || value === 'off') {
    return null;
  }
  return value;
}
