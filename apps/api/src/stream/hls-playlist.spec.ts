import { VideoResolution } from '@movie-server/shared';
import { buildMasterPlaylist, variantBandwidth } from './hls-playlist';

describe('hls-playlist', () => {
  it('builds a master playlist with relative variant URLs and no filesystem paths', () => {
    const body = buildMasterPlaylist([
      { resolution: VideoResolution.P480, bandwidth: 1_500_000 },
      { resolution: VideoResolution.P1080, bandwidth: 6_000_000 },
    ]);
    expect(body).toContain('#EXTM3U');
    expect(body).toContain('#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=854x480');
    expect(body).toContain('v/480p.m3u8');
    expect(body).toContain('v/1080p.m3u8');
    expect(body).not.toMatch(/C:\\|\/var\/|\/home\/|storage\//i);
  });

  it('embeds media token on variant playlist URLs when provided', () => {
    const body = buildMasterPlaylist(
      [{ resolution: VideoResolution.P720, bandwidth: 3_000_000 }],
      'abc123token',
    );
    expect(body).toContain('v/720p.m3u8?mt=abc123token');
  });

  it('uses bitrate when provided', () => {
    expect(variantBandwidth(VideoResolution.P1080, 8000)).toBe(8_000_000);
    expect(variantBandwidth(VideoResolution.P1080)).toBe(6_000_000);
  });
});
