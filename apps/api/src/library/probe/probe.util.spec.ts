import { parseFfprobeJson, probeFromAudioFilename, resolutionFromDimensions } from './probe.util';
import { VideoResolution } from '@movie-server/shared';

describe('probe.util', () => {
  it('maps dimensions to catalog resolutions', () => {
    expect(resolutionFromDimensions(3840, 2160)).toBe(VideoResolution.Uhd4k);
    expect(resolutionFromDimensions(1920, 1080)).toBe(VideoResolution.P1080);
    expect(resolutionFromDimensions(1280, 720)).toBe(VideoResolution.P720);
    expect(resolutionFromDimensions(720, 480)).toBe(VideoResolution.P480);
  });

  it('parses ffprobe json into probe fields', () => {
    const probe = parseFfprobeJson(
      JSON.stringify({
        streams: [
          {
            index: 0,
            codec_type: 'video',
            codec_name: 'h264',
            width: 1920,
            height: 1080,
            bit_rate: '4500000',
            avg_frame_rate: '24000/1001',
          },
          {
            index: 1,
            codec_type: 'audio',
            codec_name: 'aac',
            channels: 2,
            bit_rate: '192000',
            tags: { language: 'eng', title: 'English' },
          },
          {
            index: 2,
            codec_type: 'subtitle',
            codec_name: 'subrip',
            tags: { language: 'eng' },
            disposition: { forced: 0, hearing_impaired: 0 },
          },
        ],
        format: { duration: '7200.5', bit_rate: '5000000', size: '123456' },
      }),
      99,
    );
    expect(probe.resolution).toBe(VideoResolution.P1080);
    expect(probe.videoCodec).toBe('h264');
    expect(probe.audioCodec).toBe('aac');
    expect(probe.bitrateKbps).toBe(5000);
    expect(probe.durationMs).toBe(7200500);
    expect(probe.sizeBytes).toBe(123456);
    expect(probe.videoStreams).toHaveLength(1);
    expect(probe.audioTracks).toHaveLength(1);
    expect(probe.subtitleTracks).toHaveLength(1);
    expect(probe.audioTracks[0].channels).toBe(2);
    expect(probe.audioTracks[0].language).toBe('en');
  });

  it('builds sidecar audio probe metadata from the filename', () => {
    const probe = probeFromAudioFilename('Stream Dual (2024).hi.m4a', 2048);
    expect(probe.audioCodec).toBe('aac');
    expect(probe.audioTracks[0]).toMatchObject({ language: 'hi', codec: 'aac', channels: 2 });
    expect(probe.videoStreams).toHaveLength(0);
  });
});
