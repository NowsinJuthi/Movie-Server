import type { LibraryProbe } from '@movie-server/shared';
import {
  applyClientCapabilities,
  buildHlsTranscodeOutputArgs,
  hlsInitialSegments,
  hlsSegmentSeconds,
  hlsStreamCopyVideoArgs,
  isBrowserSafeAudioCodec,
  isBrowserSafeVideoCodec,
  planNeedsEncode,
  planTranscode,
  pickPreferredAudioOrdinal,
} from './stream-transcode.util';
import type { ConfigService } from '@nestjs/config';

function probe(partial: Partial<LibraryProbe>): LibraryProbe {
  return {
    durationMs: null,
    width: null,
    height: null,
    resolution: null,
    videoCodec: null,
    audioCodec: null,
    bitrateKbps: null,
    sizeBytes: 0,
    videoStreams: [],
    audioTracks: [],
    subtitleTracks: [],
    ...partial,
  };
}

describe('stream-transcode.util', () => {
  it('detects browser-safe codecs', () => {
    expect(isBrowserSafeVideoCodec('h264')).toBe(true);
    expect(isBrowserSafeVideoCodec('hevc')).toBe(false);
    expect(isBrowserSafeAudioCodec('aac')).toBe(true);
    expect(isBrowserSafeAudioCodec('eac3')).toBe(false);
  });

  it('prefers English AAC over EAC3 default track', () => {
    const ordinal = pickPreferredAudioOrdinal([
      { index: 0, codec: 'eac3', language: 'eng', channels: 6, bitrateKbps: 640, label: 'English' },
      { index: 1, codec: 'aac', language: 'eng', channels: 2, bitrateKbps: 192, label: 'English AAC' },
    ]);
    expect(ordinal).toBe(1);
  });

  it('plans transcode for HEVC + EAC3', () => {
    const plan = planTranscode(
      probe({
        videoCodec: 'hevc',
        audioCodec: 'eac3',
        audioTracks: [{ index: 0, codec: 'eac3', language: 'eng', channels: 6, bitrateKbps: 640, label: 'EN' }],
      }),
      'auto',
    );
    expect(plan.transcode).toBe(true);
    expect(plan.encodeVideo).toBe(true);
    expect(plan.encodeAudio).toBe(true);
    expect(plan.audioOrdinal).toBe(0);
  });

  it('audio-only transcode for H264 + EAC3', () => {
    const plan = planTranscode(
      probe({
        videoCodec: 'h264',
        audioCodec: 'eac3',
        audioTracks: [{ index: 0, codec: 'eac3', language: 'eng', channels: 6, bitrateKbps: 640, label: 'EN' }],
      }),
      'auto',
    );
    expect(plan.transcode).toBe(true);
    expect(plan.encodeVideo).toBe(false);
    expect(plan.encodeAudio).toBe(true);
  });

  it('keeps copied H264 video synchronized with encoded AAC audio', () => {
    const config = { get: () => undefined } as unknown as ConfigService;
    const plan = planTranscode(
      probe({
        videoCodec: 'h264',
        audioCodec: 'eac3',
        audioTracks: [{ index: 0, codec: 'eac3', language: 'eng', channels: 6, bitrateKbps: 640, label: 'EN' }],
      }),
      'auto',
    );
    const args = buildHlsTranscodeOutputArgs(config, plan, 4);
    expect(args).toEqual(expect.arrayContaining(['-c:v', 'copy', '-c:a', 'aac']));
    expect(args).toEqual(expect.arrayContaining(['-af', 'aresample=async=1:first_pts=0']));
    expect(args).toEqual(expect.arrayContaining(['-max_interleave_delta', '0']));
  });

  it('HEVC direct stream copies video when client supports HEVC', () => {
    const plan = applyClientCapabilities(
      planTranscode(
        probe({
          videoCodec: 'hevc',
          audioCodec: 'eac3',
          audioTracks: [{ index: 0, codec: 'eac3', language: 'eng', channels: 6, bitrateKbps: 640, label: 'EN' }],
        }),
        'auto',
      ),
      { hevcDirectStream: true },
    );
    expect(plan.transcode).toBe(true);
    expect(plan.encodeVideo).toBe(false);
    expect(plan.encodeAudio).toBe(true);
  });

  it('copy-remuxes H264 AAC MKV without transcode', () => {
    const plan = planTranscode(
      probe({
        videoCodec: 'h264',
        audioCodec: 'aac',
        audioTracks: [{ index: 0, codec: 'aac', language: 'eng', channels: 2, bitrateKbps: 192, label: 'EN' }],
      }),
      'auto',
    );
    expect(plan.transcode).toBe(false);
  });

  it('picks HEVC vs H264 HLS stream-copy args', () => {
    expect(hlsStreamCopyVideoArgs('hevc')).toEqual(['-c:v', 'copy', '-tag:v', 'hvc1']);
    expect(hlsStreamCopyVideoArgs('h264')).toEqual(['-c:v', 'copy', '-bsf:v', 'h264_mp4toannexb']);
  });

  it('uses one segment for DirectStream copy vs multiple for encode', () => {
    const config = {
      get: (key: string) =>
        ({
          HLS_TRANSCODE_INITIAL_SEGMENTS: 2,
          HLS_SEGMENT_SECONDS: 4,
          HLS_TRANSCODE_SEGMENT_SECONDS: 4,
        })[key],
    } as ConfigService;
    const copyPlan = planTranscode(
      probe({ videoCodec: 'h264', audioCodec: 'aac', audioTracks: [{ index: 0, codec: 'aac', language: 'eng', channels: 2, bitrateKbps: 192, label: 'EN' }] }),
      'auto',
    );
    const hevcPlan = planTranscode(
      probe({ videoCodec: 'hevc', audioCodec: 'aac', audioTracks: [{ index: 0, codec: 'aac', language: 'eng', channels: 2, bitrateKbps: 192, label: 'EN' }] }),
      'auto',
    );
    expect(planNeedsEncode(copyPlan)).toBe(false);
    expect(planNeedsEncode(hevcPlan)).toBe(true);
    expect(hlsInitialSegments(config, copyPlan)).toBe(1);
    expect(hlsInitialSegments(config, hevcPlan)).toBe(2);
    expect(hlsSegmentSeconds(config, copyPlan)).toBe(4);
  });
});
