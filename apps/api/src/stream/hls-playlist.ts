import { VideoResolution } from '@movie-server/shared';

const BANDWIDTH: Record<VideoResolution, number> = {
  [VideoResolution.P480]: 1_500_000,
  [VideoResolution.P720]: 3_000_000,
  [VideoResolution.P1080]: 6_000_000,
  [VideoResolution.Uhd4k]: 16_000_000,
};

const DIMS: Record<VideoResolution, [number, number]> = {
  [VideoResolution.P480]: [854, 480],
  [VideoResolution.P720]: [1280, 720],
  [VideoResolution.P1080]: [1920, 1080],
  [VideoResolution.Uhd4k]: [3840, 2160],
};

export function variantBandwidth(resolution: VideoResolution, bitrateKbps?: number | null): number {
  if (bitrateKbps && bitrateKbps > 0) {
    return bitrateKbps * 1000;
  }
  return BANDWIDTH[resolution];
}

export function buildMasterPlaylist(
  variants: Array<{ resolution: VideoResolution; bandwidth: number }>,
): string {
  const lines = ['#EXTM3U', '#EXT-X-INDEPENDENT-SEGMENTS'];
  for (const variant of variants) {
    const [width, height] = DIMS[variant.resolution];
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${variant.bandwidth},RESOLUTION=${width}x${height},NAME="${variant.resolution}"`,
    );
    lines.push(`v/${variant.resolution}`);
  }
  return `${lines.join('\n')}\n`;
}

export function buildMediaPlaylist(durationSeconds: number, resolution?: string): string {
  const duration = Math.max(1, Math.round(durationSeconds));
  const segment = resolution ? `../media?quality=${encodeURIComponent(resolution)}` : '../media';
  return [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    `#EXT-X-TARGETDURATION:${duration}`,
    '#EXT-X-PLAYLIST-TYPE:VOD',
    '#EXT-X-MEDIA-SEQUENCE:0',
    `#EXTINF:${duration}.0,`,
    segment,
    '#EXT-X-ENDLIST',
    '',
  ].join('\n');
}
