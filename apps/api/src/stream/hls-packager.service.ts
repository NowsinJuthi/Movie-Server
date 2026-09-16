import { spawn, type ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorCode } from '@movie-server/shared';
import { resolveFfmpegPath } from '../library/probe/media-binaries';
import {
  buildTranscodePlan,
  buildHlsTranscodeOutputArgs,
  ffmpegInputArgs,
  hlsInitialSegments,
  hlsSegmentSeconds,
  hlsStreamCopyVideoArgs,
  planNeedsEncode,
  type TranscodePlan,
} from './stream-transcode.util';

const PLAYLIST_NAME = 'stream.m3u8';
const SEGMENT_PATTERN = /^seg\d+\.ts$/i;

type SessionPackState = {
  startSeconds: number;
  plan: TranscodePlan;
};

@Injectable()
export class HlsPackagerService {
  private readonly logger = new Logger(HlsPackagerService.name);
  private readonly baseDir: string;
  private readonly segmentSeconds: number;
  private readonly processes = new Map<string, ChildProcess>();
  private readonly stopping = new WeakSet<ChildProcess>();
  private readonly starting = new Map<string, Promise<string>>();
  private readonly sessionPack = new Map<string, SessionPackState>();

  constructor(private readonly config: ConfigService) {
    this.baseDir =
      this.config.get<string>('HLS_PACK_DIR') ?? path.join(process.cwd(), 'storage', 'hls-pack');
    this.segmentSeconds = this.config.get<number>('HLS_SEGMENT_SECONDS') ?? 4;
  }

  outputDir(sessionId: string): string {
    return path.join(this.baseDir, sessionId);
  }

  packStartSeconds(sessionId: string): number {
    return this.sessionPack.get(sessionId)?.startSeconds ?? 0;
  }

  /** Start ffmpeg HLS packaging (copy or transcode) and wait until the first segment exists. */
  async ensureFirstSegment(
    sessionId: string,
    absPath: string,
    options?: { startSeconds?: number; timeoutMs?: number; plan?: TranscodePlan },
  ): Promise<string> {
    const startSeconds = Math.max(0, options?.startSeconds ?? 0);
    const prior = this.sessionPack.get(sessionId);
    const plan = options?.plan ?? prior?.plan ?? (await buildTranscodePlan(absPath, this.config));

    if (
      prior &&
      (prior.startSeconds !== startSeconds || packagingPlanKey(prior.plan) !== packagingPlanKey(plan))
    ) {
      await this.stopPackaging(sessionId);
    }
    this.sessionPack.set(sessionId, { startSeconds, plan });

    const existing = this.starting.get(sessionId);
    if (existing) {
      return existing;
    }

    const encode = planNeedsEncode(plan);
    const effectiveTimeout =
      options?.timeoutMs ??
      (encode ? (this.config.get<number>('HLS_TRANSCODE_TIMEOUT_MS') ?? 180_000) : 60_000);

    const outDir = this.outputDir(sessionId);
    // A seek only needs one short segment before playback can resume. Waiting for
    // the normal startup buffer here makes every scrub feel several seconds slower.
    const initialSegments = startSeconds > 0.5 ? 1 : hlsInitialSegments(this.config, plan);
    try {
      await this.assertSegmentsReady(outDir, initialSegments);
      if (!prior || prior.startSeconds === startSeconds) {
        return outDir;
      }
    } catch {
      /* start packaging */
    }

    const job = this.runPackaging(
      sessionId,
      absPath,
      outDir,
      initialSegments,
      effectiveTimeout,
      plan,
      startSeconds,
    );
    this.starting.set(sessionId, job);
    try {
      return await job;
    } finally {
      this.starting.delete(sessionId);
    }
  }

  async readPlaylistForApi(sessionId: string, mediaToken: string): Promise<string> {
    const playlistPath = path.join(this.outputDir(sessionId), PLAYLIST_NAME);
    const raw = await fs.readFile(playlistPath, 'utf8');
    return rewriteHlsPlaylist(raw, sessionId, mediaToken);
  }

  resolveSegmentPath(sessionId: string, segment: string): string {
    const name = path.basename(segment);
    if (!SEGMENT_PATTERN.test(name)) {
      throw new ServiceUnavailableException({
        error: ErrorCode.NotFound,
        message: 'Segment not found.',
      });
    }
    return path.join(this.outputDir(sessionId), name);
  }

  async cleanup(sessionId: string): Promise<void> {
    await this.stopPackaging(sessionId);
    this.sessionPack.delete(sessionId);
  }

  private async stopPackaging(sessionId: string): Promise<void> {
    const proc = this.processes.get(sessionId);
    if (proc) {
      this.stopping.add(proc);
      proc.kill('SIGTERM');
      await waitForProcessExit(proc, 3_000);
      if (proc.exitCode === null && proc.signalCode === null) {
        proc.kill('SIGKILL');
        await waitForProcessExit(proc, 2_000);
      }
      if (this.processes.get(sessionId) === proc) {
        this.processes.delete(sessionId);
      }
    }
    this.starting.delete(sessionId);
    try {
      await fs.rm(this.outputDir(sessionId), { recursive: true, force: true });
    } catch {
      /* already gone */
    }
  }

  private async assertSegmentsReady(outDir: string, count: number): Promise<void> {
    for (let i = 0; i < count; i += 1) {
      const info = await fs.stat(path.join(outDir, `seg${String(i).padStart(3, '0')}.ts`));
      if (!info.isFile() || info.size < 188 || info.size % 188 !== 0) {
        throw new Error('HLS segment is not complete.');
      }
    }
  }

  private runPackaging(
    sessionId: string,
    absPath: string,
    outDir: string,
    initialSegments: number,
    timeoutMs: number,
    plan: TranscodePlan,
    startSeconds: number,
  ): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        await fs.mkdir(outDir, { recursive: true });
      } catch (error) {
        reject(error);
        return;
      }

      let bin: string;
      try {
        bin = resolveFfmpegPath(this.config);
      } catch (error) {
        reject(error);
        return;
      }

      const playlistPath = path.join(outDir, PLAYLIST_NAME);
      const segmentSeconds = packagingSegmentSeconds(this.config, plan, startSeconds);
      const args = buildFfmpegHlsArgs(
        absPath,
        outDir,
        plan,
        segmentSeconds,
        startSeconds,
        this.config,
      );

      const child = spawn(bin, args, { windowsHide: true });
      this.processes.set(sessionId, child);
      let stderr = '';

      child.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8').trim();
        if (text) {
          stderr = `${stderr}\n${text}`.trim();
        }
      });

      child.on('error', (error) => {
        if (this.processes.get(sessionId) === child) {
          this.processes.delete(sessionId);
        }
        reject(error);
      });

      child.on('close', (code) => {
        if (this.processes.get(sessionId) === child) {
          this.processes.delete(sessionId);
        }
        const intentionallyStopped = this.stopping.delete(child);
        if (code === 0) {
          void this.finalizePlaylist(playlistPath);
          return;
        }
        if (intentionallyStopped) {
          return;
        }
        this.logger.warn(
          `HLS ${planNeedsEncode(plan) ? 'transcode' : 'direct-stream'} failed for ${sessionId} (exit ${code}): ${stderr}`,
        );
      });

      const deadline = Date.now() + timeoutMs;
      const poll = setInterval(() => {
        void (async () => {
          try {
            await this.assertSegmentsReady(outDir, initialSegments);
            clearInterval(poll);
            resolve(outDir);
          } catch {
            if (Date.now() >= deadline) {
              clearInterval(poll);
              child.kill('SIGTERM');
              reject(
                new ServiceUnavailableException({
                  error: ErrorCode.PlaybackUnavailable,
                  message: 'Video packaging timed out. Try again in a moment.',
                }),
              );
            } else if (child.exitCode !== null && child.exitCode !== 0) {
              clearInterval(poll);
              reject(
                new ServiceUnavailableException({
                  error: ErrorCode.PlaybackUnavailable,
                  message: 'This file could not be packaged for mobile playback.',
                }),
              );
            }
          }
        })();
      }, 200);
    });
  }

  private async finalizePlaylist(playlistPath: string): Promise<void> {
    try {
      const raw = await fs.readFile(playlistPath, 'utf8');
      if (raw.includes('#EXT-X-ENDLIST')) {
        return;
      }
      await fs.writeFile(playlistPath, `${raw.trim()}\n#EXT-X-ENDLIST\n`, 'utf8');
    } catch {
      /* best effort */
    }
  }
}

export function packagingSegmentSeconds(
  config: ConfigService,
  plan: TranscodePlan,
  startSeconds: number,
): number {
  const normal = hlsSegmentSeconds(config, plan);
  if (startSeconds <= 0.5) {
    return normal;
  }
  const seekSeconds = config.get<number>('HLS_SEEK_SEGMENT_SECONDS') ?? 2;
  return Math.max(1, Math.min(normal, seekSeconds));
}

export function buildFfmpegHlsArgs(
  absPath: string,
  outDir: string,
  plan: TranscodePlan,
  segmentSeconds: number,
  startSeconds: number,
  config: ConfigService,
): string[] {
  const playlistPath = path.join(outDir, PLAYLIST_NAME);
  const segmentPath = path.join(outDir, 'seg%03d.ts');
  const base = [
    ...ffmpegInputArgs(absPath, startSeconds, config),
    '-map',
    '0:v:0',
    '-map',
    `0:a:${Math.max(0, plan.audioOrdinal)}?`,
  ];
  const hlsTail = [
    '-f',
    'hls',
    '-hls_time',
    String(segmentSeconds),
    '-hls_list_size',
    '0',
    '-hls_flags',
    'independent_segments+append_list+omit_endlist+program_date_time+temp_file',
    '-hls_segment_filename',
    segmentPath,
    playlistPath,
  ];
  if (plan.transcode) {
    return [...base, ...buildHlsTranscodeOutputArgs(config, plan, segmentSeconds), ...hlsTail];
  }
  return [...base, ...hlsStreamCopyVideoArgs(plan.probe.videoCodec), '-c:a', 'copy', ...hlsTail];
}

export function rewriteHlsPlaylist(
  raw: string,
  sessionId: string,
  mediaToken: string,
): string {
  const mt = encodeURIComponent(mediaToken);
  const prefix = `/api/v1/stream/${sessionId}/hls/`;
  return raw
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return line;
      }
      const name = path.basename(trimmed.split('?')[0] ?? trimmed);
      if (SEGMENT_PATTERN.test(name)) {
        return `${prefix}${name}?mt=${mt}`;
      }
      return line;
    })
    .join('\n');
}

function waitForProcessExit(child: ChildProcess, timeoutMs: number): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timer = setTimeout(done, timeoutMs);
    child.once('close', done);

    function done(): void {
      clearTimeout(timer);
      child.off('close', done);
      resolve();
    }
  });
}

function packagingPlanKey(plan: TranscodePlan): string {
  return [
    plan.encodeVideo ? 'v1' : 'v0',
    plan.encodeAudio ? 'a1' : 'a0',
    `o${plan.audioOrdinal}`,
    plan.probe.videoCodec ?? '',
  ].join(':');
}
