export function clampReleaseYear(year: number | undefined, fallback = new Date().getFullYear()): number {
  const value = Number.isFinite(year) ? Number(year) : fallback;
  if (value < 1888) {
    return 1888;
  }
  if (value > 2100) {
    return 2100;
  }
  return Math.round(value);
}

export function runtimeMinutesFromMs(durationMs: number | null | undefined, fallback = 90): number {
  if (typeof durationMs === 'number' && durationMs > 0) {
    return Math.min(600, Math.max(1, Math.round(durationMs / 60_000)));
  }
  return Math.min(600, Math.max(1, fallback));
}

export function fallbackDescription(title: string): string {
  const trimmed = title.trim() || 'Untitled';
  return `Imported from your media library: ${trimmed}.`;
}
