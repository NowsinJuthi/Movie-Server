import { spawn, type ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorCode } from '@movie-server/shared';
import { resolveFfmpegPath } from '../library/probe/media-binaries';

const PLAYLIST_NAME = 'stream.m3u8';
const SEGMENT_PATTERN = /^seg\d+\.ts$/i;

@Injectable()
export class HlsPackagerService {
  private readonly logger = new Logger(HlsPackagerService.name);
  private readonly baseDir: string;
  private readonly segmentSeconds: number;
  private readonly processes = new Map<string, ChildProcess>();
  private readonly starting = new Map<string, Promise<string>>();

  constructor(private readonly config: ConfigService) {
    this.baseDir =
      this.config.get<string>('HLS_PACK_DIR') ?? path.join(process.cwd(), 'storage', 'hls-pack');
    this.segmentSeconds = this.config.get<number>('HLS_SEGMENT_SECONDS') ?? 4;
  }

  outputDir(sessionId: string): string {
    return path.join(this.baseDir, sessionId);
  }

  /** Start ffmpeg HLS packaging (codec copy) and wait until the first segment exists. */
  async ensureFirstSegment(sessionId: string, absPath: string, timeoutMs = 90_000): Promise<string> {
    const existing = this.starting.get(sessionId);
    if (existing) {
      return existing;
    }

    const outDir = this.outputDir(sessionId);
    const firstSegment = path.join(outDir, 'seg000.ts');
    try {
      await fs.access(firstSegment);
      return outDir;
    } catch {
      /* start packaging */
    }

    const job = this.runPackaging(sessionId, absPath, outDir, firstSegment, timeoutMs);
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
    const proc = this.processes.get(sessionId);
    if (proc) {
      proc.kill('SIGTERM');
      this.processes.delete(sessionId);
    }
    this.starting.delete(sessionId);
    try {
      await fs.rm(this.outputDir(sessionId), { recursive: true, force: true });
    } catch {
      /* already gone */
    }
  }

  private runPackaging(
    sessionId: string,
    absPath: string,
    outDir: string,
    firstSegment: string,
    timeoutMs: number,
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
      const segmentPath = path.join(outDir, 'seg%03d.ts');
      const args = [
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        absPath,
        '-map',
        '0:v:0',
        '-map',
        '0:a:0?',
        '-c',
        'copy',
        '-bsf:v',
        'h264_mp4toannexb',
        '-f',
        'hls',
        '-hls_time',
        String(this.segmentSeconds),
        '-hls_list_size',
        '0',
        '-hls_flags',
        'independent_segments+append_list+omit_endlist',
        '-hls_segment_filename',
        segmentPath,
        playlistPath,
      ];

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
        this.processes.delete(sessionId);
        reject(error);
      });

      child.on('close', (code) => {
        this.processes.delete(sessionId);
        if (code === 0) {
          void this.finalizePlaylist(playlistPath);
          return;
        }
        this.logger.warn(`HLS packaging failed for ${sessionId} (exit ${code}): ${stderr}`);
      });

      const deadline = Date.now() + timeoutMs;
      const poll = setInterval(() => {
        void (async () => {
          try {
            await fs.access(firstSegment);
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
      }, 350);
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

export function rewriteHlsPlaylist(raw: string, sessionId: string, mediaToken: string): string {
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
