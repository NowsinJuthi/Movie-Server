import { VideoResolution } from '@movie-server/shared';
import { buildMasterPlaylist, buildMediaPlaylist, variantBandwidth } from './hls-playlist';

describe('hls-playlist', () => {
  it('builds a master playlist with relative variant URLs and no filesystem paths', () => {
    const body = buildMasterPlaylist([
      { resolution: VideoResolution.P480, bandwidth: 1_500_000 },
      { resolution: VideoResolution.P1080, bandwidth: 6_000_000 },
    ]);
    expect(body).toContain('#EXTM3U');
    expect(body).toContain('#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=854x480');
    expect(body).toContain('v/480p');
    expect(body).toContain('v/1080p');
    expect(body).not.toMatch(/C:\\|\/var\/|\/home\/|storage\//i);
  });

  it('points media playlists at an authorized media URL including quality', () => {
    const body = buildMediaPlaylist(128, VideoResolution.P720);
    expect(body).toContain('#EXT-X-PLAYLIST-TYPE:VOD');
    expect(body).toContain('../media?quality=720p');
    expect(body).toContain('#EXT-X-ENDLIST');
    expect(body).not.toMatch(/C:\\|\/var\/|storage\//i);
  });

  it('uses bitrate when provided', () => {
    expect(variantBandwidth(VideoResolution.P1080, 8000)).toBe(8_000_000);
    expect(variantBandwidth(VideoResolution.P1080)).toBe(6_000_000);
  });
});
