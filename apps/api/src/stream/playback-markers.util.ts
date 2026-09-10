import { emptyPlaybackMarkers, type PlaybackMarkers } from '@movie-server/shared';
import type { PlaybackMarkersEmbed } from '../common/schemas/playback-markers.schema';

export function toPlaybackMarkers(doc?: PlaybackMarkersEmbed | null): PlaybackMarkers {
  if (!doc) {
    return emptyPlaybackMarkers();
  }
  return {
    introStartSeconds: doc.introStartSeconds ?? null,
    introEndSeconds: doc.introEndSeconds ?? null,
    recapStartSeconds: doc.recapStartSeconds ?? null,
    recapEndSeconds: doc.recapEndSeconds ?? null,
    creditsStartSeconds: doc.creditsStartSeconds ?? null,
  };
}

const MARKER_KEYS = [
  'introStartSeconds',
  'introEndSeconds',
  'recapStartSeconds',
  'recapEndSeconds',
  'creditsStartSeconds',
] as const;

export function foldMarkerFields(dto: Record<string, unknown>): Record<string, unknown> {
  const next = { ...dto };
  for (const key of MARKER_KEYS) {
    if (next[key] !== undefined) {
      next[`markers.${key}`] = next[key];
      delete next[key];
    }
  }
  return next;
}
