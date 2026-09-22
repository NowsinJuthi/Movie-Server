import { spawn } from 'child_process';
import { stat } from 'fs/promises';
import type { ConfigService } from '@nestjs/config';
import type { LibraryProbe } from '@movie-server/shared';
import { parseFfprobeJson } from '../library/probe/probe.util';
import { resolveFfprobePath } from '../library/probe/media-binaries';

export type TranscodePlan = {
  transcode: boolean;
  /** Re-encode video (HEVC/VP9). When false, H.264 is stream-copied. */
  encodeVideo: boolean;
  /** Re-encode audio (EAC3/DTS). When false, AAC/MP3 is stream-copied. */
  encodeAudio: boolean;
  audioOrdinal: number;
  probe: LibraryProbe;
};

export function transcodeMode(config: ConfigService): 'auto' | 'always' | 'never' {
  const raw = (config.get<string>('STREAM_TRANSCODE') ?? 'auto').toLowerCase();
  if (raw === 'always' || raw === 'never') {
    return raw;
  }
  return 'auto';
}

export function isHevcVideoCodec(codec: string | null | undefined): boolean {
  if (!codec) {
    return false;
  }
  const value = codec.toLowerCase();
  return value.includes('hevc') || value.includes('h265') || value === 'hev1' || value === 'hvc1';
}

export function applyClientCapabilities(
  plan: TranscodePlan,
  client?: { hevcDirectStream?: boolean },
): TranscodePlan {
  if (!client?.hevcDirectStream || !plan.encodeVideo || !isHevcVideoCodec(plan.probe.videoCodec)) {
    return plan;
  }
  return {
    ...plan,
    encodeVideo: false,
    transcode: plan.encodeAudio,
  };
}

export function isBrowserSafeVideoCodec(codec: string | null | undefined): boolean {
  if (!codec) {
    return false;
  }
  const value = codec.toLowerCase();
  return value.includes('h264') || value === 'avc';
}

export function isBrowserSafeAudioCodec(codec: string | null | undefined): boolean {
  if (!codec) {
    return false;
  }
  const value = codec.toLowerCase();
  return value === 'aac' || value === 'mp3';
}

export function pickPreferredAudioOrdinal(tracks: LibraryProbe['audioTracks']): number {
  if (tracks.length === 0) {
    return 0;
  }
  let best = 0;
  let bestScore = -1;
  tracks.forEach((track, ordinal) => {
    let score = 0;
    const lang = (track.language ?? '').toLowerCase();
    if (lang.startsWith('en')) {
      score += 20;
    }
    const codec = (track.codec ?? '').toLowerCase();
    if (codec === 'aac') {
      score += 10;
    } else if (codec === 'mp3') {
      score += 8;
    } else if (codec === 'eac3' || codec === 'ac3' || codec === 'dts') {
      score += 3;
    }
    if (score > bestScore) {
      bestScore = score;
      best = ordinal;
    }
  });
  return best;
}

export function planTranscode(probe: LibraryProbe, mode: 'auto' | 'always' | 'never'): TranscodePlan {
  const audioOrdinal = pickPreferredAudioOrdinal(probe.audioTracks);
  const audioCodec = probe.audioTracks[audioOrdinal]?.codec ?? probe.audioCodec;
  if (mode === 'never') {
    return { transcode: false, encodeVideo: false, encodeAudio: false, audioOrdinal, probe };
  }
  if (mode === 'always') {
    return { transcode: true, encodeVideo: true, encodeAudio: true, audioOrdinal, probe };
  }
  const encodeVideo = !isBrowserSafeVideoCodec(probe.videoCodec);
  const encodeAudio = !isBrowserSafeAudioCodec(audioCodec);
  return {
    transcode: encodeVideo || encodeAudio,
    encodeVideo,
    encodeAudio,
    audioOrdinal,
    probe,
  };
}

export async function probeMediaFile(absPath: string, config: ConfigService): Promise<LibraryProbe> {
  let sizeBytes = 0;
  try {
    const info = await stat(absPath);
    sizeBytes = info.size;
  } catch {
    sizeBytes = 0;
  }
  const raw = await runFfprobe(absPath, config);
  return parseFfprobeJson(raw, sizeBytes);
}

export async function buildTranscodePlan(
  absPath: string,
  config: ConfigService,
): Promise<TranscodePlan> {
  const probe = await probeMediaFile(absPath, config);
  return planTranscode(probe, transcodeMode(config));
}

export function buildTranscodePlanFromProbe(
  probe: LibraryProbe,
  config: ConfigService,
): TranscodePlan {
  return planTranscode(probe, transcodeMode(config));
}

export function transcodeSegmentSeconds(config: ConfigService): number {
  return config.get<number>('HLS_TRANSCODE_SEGMENT_SECONDS') ?? 4;
}

export function transcodeInitialSegments(config: ConfigService): number {
  return config.get<number>('HLS_TRANSCODE_INITIAL_SEGMENTS') ?? 2;
}

/** True when ffmpeg must re-encode (HEVC/EAC3). False = Emby DirectStream (codec copy only). */
export function planNeedsEncode(plan: TranscodePlan): boolean {
  return plan.encodeVideo || plan.encodeAudio;
}

export function hlsSegmentSeconds(config: ConfigService, plan: TranscodePlan): number {
  if (planNeedsEncode(plan)) {
    return transcodeSegmentSeconds(config);
  }
  return config.get<number>('HLS_SEGMENT_SECONDS') ?? 4;
}

export function hlsInitialSegments(config: ConfigService, plan: TranscodePlan): number {
  if (planNeedsEncode(plan)) {
    return transcodeInitialSegments(config);
  }
  return 1;
}

function transcodeMaxHeight(config: ConfigService): number {
  return config.get<number>('STREAM_TRANSCODE_MAX_HEIGHT') ?? 1080;
}

function transcodeMaxFps(config: ConfigService): number {
  return config.get<number>('STREAM_TRANSCODE_MAX_FPS') ?? 0;
}

function transcodeEncoder(config: ConfigService): string {
  return (config.get<string>('STREAM_TRANSCODE_ENCODER') ?? 'libx264').toLowerCase();
}

function transcodeHwaccel(config: ConfigService): string {
  return (config.get<string>('STREAM_TRANSCODE_HWACCEL') ?? 'auto').toLowerCase();
}

function scaleFilter(config: ConfigService, probe?: LibraryProbe): string | null {
  const maxHeight = transcodeMaxHeight(config);
  const maxFps = transcodeMaxFps(config);
  const sourceHeight = probe?.height ?? 0;
  const parts: string[] = [];
  if (maxHeight > 0 && (sourceHeight <= 0 || sourceHeight > maxHeight)) {
    parts.push(`scale=-2:'min(ih,${maxHeight})'`);
  }
  if (maxFps > 0) {
    parts.push(`fps=${maxFps}`);
  }
  return parts.length > 0 ? parts.join(',') : null;
}

function videoEncodeArgs(
  config: ConfigService,
  segmentSeconds: number,
  probe?: LibraryProbe,
): string[] {
  const gop = Math.max(24, Math.round(segmentSeconds * 24));
  const scale = scaleFilter(config, probe);
  const vf = scale ? ['-vf', scale] : [];
  const encoder = transcodeEncoder(config);

  if (encoder === 'h264_nvenc') {
    return [
      ...vf,
      '-c:v',
      'h264_nvenc',
      '-preset',
      'p1',
      '-tune',
      'll',
      '-g',
      String(gop),
      '-pix_fmt',
      'yuv420p',
    ];
  }
  if (encoder === 'h264_qsv') {
    return [
      ...vf,
      '-c:v',
      'h264_qsv',
      '-preset',
      'veryfast',
      '-g',
      String(gop),
      '-pix_fmt',
      'yuv420p',
    ];
  }
  if (encoder === 'h264_vaapi') {
    return [
      ...vf,
      '-c:v',
      'h264_vaapi',
      '-g',
      String(gop),
    ];
  }

  const preset = config.get<string>('STREAM_TRANSCODE_PRESET') ?? 'ultrafast';
  const crf = config.get<number>('STREAM_TRANSCODE_CRF') ?? 26;
  return [
    ...vf,
    '-c:v',
    'libx264',
    '-preset',
    preset,
    '-crf',
    String(crf),
    '-pix_fmt',
    'yuv420p',
    '-profile:v',
    'main',
    '-g',
    String(gop),
    '-keyint_min',
    String(gop),
    '-sc_threshold',
    '0',
    '-bf',
    '0',
    '-refs',
    '1',
    '-x264-params',
    'rc-lookahead=0:sync-lookahead=0',
    '-threads',
    '0',
  ];
}

function audioEncodeArgs(syncToCopiedVideo = false): string[] {
  const args = ['-c:a', 'aac', '-b:a', '192k', '-ac', '2'];
  if (syncToCopiedVideo) {
    args.push('-af', 'aresample=async=1:first_pts=0');
  }
  return args;
}

/** Legacy helper — full video+audio transcode args. */
export function x264TranscodeArgs(
  config: ConfigService,
  segmentSeconds: number,
  probe?: LibraryProbe,
): string[] {
  return [...videoEncodeArgs(config, segmentSeconds, probe), ...audioEncodeArgs()];
}

/** Stream-copy video for HLS/MPEG-TS (codec-aware bitstream filters). */
export function hlsStreamCopyVideoArgs(videoCodec: string | null | undefined): string[] {
  if (isHevcVideoCodec(videoCodec)) {
    return ['-c:v', 'copy', '-tag:v', 'hvc1'];
  }
  return ['-c:v', 'copy', '-bsf:v', 'h264_mp4toannexb'];
}

export function buildHlsTranscodeOutputArgs(
  config: ConfigService,
  plan: TranscodePlan,
  segmentSeconds: number,
): string[] {
  const args: string[] = [];
  if (plan.encodeVideo) {
    args.push(...videoEncodeArgs(config, segmentSeconds, plan.probe));
  } else {
    args.push(...hlsStreamCopyVideoArgs(plan.probe.videoCodec));
  }
  if (plan.encodeAudio) {
    args.push(...audioEncodeArgs(!plan.encodeVideo));
  } else {
    args.push('-c:a', 'copy');
  }
  if (plan.encodeAudio && !plan.encodeVideo) {
    args.push('-max_interleave_delta', '0');
  }
  args.push('-max_muxing_queue_size', '9999');
  return args;
}

export function ffmpegInputArgs(absPath: string, startSeconds: number, config?: ConfigService): string[] {
  const args: string[] = ['-hide_banner', '-loglevel', 'error'];
  if (startSeconds > 0.5) {
    args.push('-ss', startSeconds.toFixed(3));
  }
  const hwaccel = config ? transcodeHwaccel(config) : 'none';
  if (hwaccel !== 'none') {
    args.push('-hwaccel', hwaccel === 'auto' ? 'auto' : hwaccel);
  }
  args.push(
    '-probesize',
    startSeconds > 0.5 ? '5M' : '32M',
    '-analyzeduration',
    startSeconds > 0.5 ? '2M' : '10M',
    '-fflags',
    '+genpts+discardcorrupt',
    '-threads',
    '0',
    '-i',
    absPath,
  );
  return args;
}

function runFfprobe(absPath: string, config: ConfigService): Promise<string> {
  const bin = resolveFfprobePath(config);
  return new Promise((resolve, reject) => {
    const child = spawn(
      bin,
      ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', absPath],
      { windowsHide: true },
    );
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('ffprobe timed out'));
    }, 45_000);
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr.trim() || `ffprobe exited ${code}`));
        return;
      }
      resolve(stdout);
    });
  });
}
