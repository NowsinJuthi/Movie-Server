import { spawn } from 'child_process';
import { Readable } from 'stream';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveFfmpegPath } from '../library/probe/media-binaries';

@Injectable()
export class FfmpegRemuxService {
  private readonly logger = new Logger(FfmpegRemuxService.name);

  constructor(private readonly config: ConfigService) {}

  available(): boolean {
    try {
      return Boolean(resolveFfmpegPath(this.config));
    } catch {
      return false;
    }
  }

  /**
   * Extract one embedded audio stream as AAC ADTS for the HTMLAudioElement.
   * Keeps the original video progressive stream intact (correct duration/seek).
   */
  openAudioExtract(absPath: string, audioOrdinal: number, startSeconds = 0): Readable {
    const bin = resolveFfmpegPath(this.config);
    const args = [
      '-hide_banner',
      '-loglevel',
      'error',
      ...(startSeconds > 0.5 ? ['-ss', startSeconds.toFixed(3)] : []),
      '-i',
      absPath,
      '-map',
      `0:a:${Math.max(0, audioOrdinal)}`,
      '-vn',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-ac',
      '2',
      '-f',
      'adts',
      'pipe:1',
    ];
    const child = spawn(bin, args, { windowsHide: true });
    const stdout = child.stdout;
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8').trim();
      if (text) this.logger.warn(`ffmpeg audio: ${text}`);
    });
    child.on('error', (error) => {
      stdout.destroy(error);
    });
    child.on('close', (code) => {
      if (code && code !== 0) {
        stdout.destroy(new Error(`ffmpeg exited ${code}`));
      }
    });
    return stdout;
  }

  /**
   * Remux MKV/WebM (H.264/AAC) to fragmented MP4 for browser <video> playback.
   * Seeking is limited while streaming; prefer storing MP4 when possible.
   */
  openVideoRemux(absPath: string, startSeconds = 0): Readable {
    const bin = resolveFfmpegPath(this.config);
    const args = [
      '-hide_banner',
      '-loglevel',
      'error',
      ...(startSeconds > 0.5 ? ['-ss', startSeconds.toFixed(3)] : []),
      '-i',
      absPath,
      '-map',
      '0:v:0',
      '-map',
      '0:a:0?',
      '-c',
      'copy',
      '-f',
      'mp4',
      '-movflags',
      'frag_keyframe+empty_moov+default_base_moof',
      'pipe:1',
    ];
    const child = spawn(bin, args, { windowsHide: true });
    const stdout = child.stdout;
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8').trim();
      if (text) this.logger.warn(`ffmpeg video: ${text}`);
    });
    child.on('error', (error) => {
      stdout.destroy(error);
    });
    child.on('close', (code) => {
      if (code && code !== 0) {
        stdout.destroy(new Error(`ffmpeg exited ${code}`));
      }
    });
    return stdout;
  }
}
