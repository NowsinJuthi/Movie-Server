import type { ConfigService } from '@nestjs/config';
import type { LibraryProbe } from '@movie-server/shared';
import {
  buildFfmpegHlsArgs,
  packagingSegmentSeconds,
  rewriteHlsPlaylist,
} from './hls-packager.service';
import type { TranscodePlan } from './stream-transcode.util';

describe('rewriteHlsPlaylist', () => {
  it('rewrites segment lines with media token auth paths', () => {
    const raw = ['#EXTM3U', '#EXTINF:4.0,', 'seg000.ts', 'seg001.ts'].join('\n');
    const out = rewriteHlsPlaylist(raw, 'abc123', 'tok456');
    expect(out).toContain('/api/v1/stream/abc123/hls/seg000.ts?mt=tok456');
    expect(out).toContain('/api/v1/stream/abc123/hls/seg001.ts?mt=tok456');
    expect(out).toContain('#EXTM3U');
  });

  it('does not apply an absolute movie offset to a restarted playlist', () => {
    const raw = ['#EXTM3U', '#EXTINF:4.0,', 'seg000.ts'].join('\n');
    const out = rewriteHlsPlaylist(raw, 'abc123', 'tok456');
    expect(out).not.toContain('#EXT-X-START');
  });

  it('writes HLS segments atomically', () => {
    const probe: LibraryProbe = {
      durationMs: 60_000,
      width: 1920,
      height: 1080,
      resolution: '1080p',
      videoCodec: 'h264',
      audioCodec: 'aac',
      bitrateKbps: 4_000,
      sizeBytes: 1_000,
      videoStreams: [],
      audioTracks: [],
      subtitleTracks: [],
    };
    const plan: TranscodePlan = {
      transcode: false,
      encodeVideo: false,
      encodeAudio: false,
      audioOrdinal: 0,
      probe,
    };
    const config = { get: () => undefined } as unknown as ConfigService;
    const args = buildFfmpegHlsArgs('/media/movie.mkv', '/tmp/hls', plan, 4, 0, config);
    expect(args).toEqual(
      expect.arrayContaining([
        '-hls_flags',
        'independent_segments+append_list+omit_endlist+program_date_time+temp_file',
      ]),
    );
  });

  it('uses short segments after a seek so playback resumes quickly', () => {
    const probe: LibraryProbe = {
      durationMs: 60_000,
      width: 1920,
      height: 1080,
      resolution: '1080p',
      videoCodec: 'hevc',
      audioCodec: 'aac',
      bitrateKbps: 4_000,
      sizeBytes: 1_000,
      videoStreams: [],
      audioTracks: [],
      subtitleTracks: [],
    };
    const plan: TranscodePlan = {
      transcode: true,
      encodeVideo: true,
      encodeAudio: false,
      audioOrdinal: 0,
      probe,
    };
    const config = {
      get: (key: string) =>
        ({ HLS_TRANSCODE_SEGMENT_SECONDS: 4, HLS_SEEK_SEGMENT_SECONDS: 2 })[key],
    } as unknown as ConfigService;

    expect(packagingSegmentSeconds(config, plan, 0)).toBe(4);
    expect(packagingSegmentSeconds(config, plan, 120)).toBe(2);
  });
});
