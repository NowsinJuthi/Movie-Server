import { rewriteHlsPlaylist } from './hls-packager.service';

describe('rewriteHlsPlaylist', () => {
  it('rewrites segment lines with media token auth paths', () => {
    const raw = ['#EXTM3U', '#EXTINF:4.0,', 'seg000.ts', 'seg001.ts'].join('\n');
    const out = rewriteHlsPlaylist(raw, 'abc123', 'tok456');
    expect(out).toContain('/api/v1/stream/abc123/hls/seg000.ts?mt=tok456');
    expect(out).toContain('/api/v1/stream/abc123/hls/seg001.ts?mt=tok456');
    expect(out).toContain('#EXTM3U');
  });
});
