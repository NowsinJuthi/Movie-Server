import type { PlaybackMarkers, PlaybackSessionInfo } from "@movie-server/shared";

const PREFIX = "cv-playback:";
const MAX_AGE_MS = 90_000;

export type CachedPlayback = {
  session: PlaybackSessionInfo | null;
  markers: PlaybackMarkers;
  resumeSeconds: number;
  savedAt: number;
};

export function cachePlayback(mediaKey: string, data: Omit<CachedPlayback, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      PREFIX + mediaKey,
      JSON.stringify({ ...data, savedAt: Date.now() }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function takeCachedPlayback(mediaKey: string): CachedPlayback | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(PREFIX + mediaKey);
  if (!raw) return null;
  sessionStorage.removeItem(PREFIX + mediaKey);
  try {
    const parsed = JSON.parse(raw) as CachedPlayback;
    if (!parsed.savedAt || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
