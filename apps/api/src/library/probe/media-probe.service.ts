import { spawn } from 'child_process';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LibraryProbe } from '@movie-server/shared';
import { emptyProbe, parseFfprobeJson, probeFromAudioFilename, probeFromFilename } from './probe.util';
import { isAudioFile, isSubtitleFile } from '../matching/filename-parser';
import { probeMp4AudioTracks } from './mp4-container-probe';
import { resolveFfprobePath } from './media-binaries';
import { languageLabel } from '@movie-server/shared';

@Injectable()
export class MediaProbeService {
  private readonly logger = new Logger(MediaProbeService.name);

  constructor(private readonly config: ConfigService) {}

  async probe(absPath: string, fileName: string, sizeBytes: number): Promise<LibraryProbe> {
    if (isSubtitleFile(fileName)) {
      return emptyProbe(sizeBytes);
    }
    if (this.useFake()) {
      return isAudioFile(fileName) ? probeFromAudioFilename(fileName, sizeBytes) : probeFromFilename(fileName, sizeBytes);
    }
    let probe: LibraryProbe;
    try {
      const json = await this.runFfprobe(absPath);
      probe = parseFfprobeJson(json, sizeBytes);
    } catch (error) {
      this.logger.warn(`ffprobe failed for ${fileName}; using filename metadata.`);
      void error;
      probe = isAudioFile(fileName) ? probeFromAudioFilename(fileName, sizeBytes) : probeFromFilename(fileName, sizeBytes);
    }
    return this.enrichMp4AudioTracks(absPath, fileName, probe);
  }

  private useFake(): boolean {
    const mode = this.config.get<string>('MEDIA_PROBE') ?? 'auto';
    if (mode === 'fake') {
      return true;
    }
    if (mode === 'ffprobe') {
      return false;
    }
    return this.config.get('NODE_ENV') === 'test';
  }

  private enrichMp4AudioTracks(absPath: string, fileName: string, probe: LibraryProbe): LibraryProbe {
    if (!/\.mp4$/i.test(fileName) && !/\.m4v$/i.test(fileName)) {
      return probe;
    }
    try {
      const container = probeMp4AudioTracks(absPath);
      if (container.length <= probe.audioTracks.length) {
        return probe;
      }
      const audioTracks = container.map((hint, index) => {
        const existing = probe.audioTracks[index];
        if (existing) return existing;
        return {
          index: index,
          codec: probe.audioCodec ?? 'aac',
          language: hint.language ?? 'und',
          channels: 2,
          bitrateKbps: null,
          label: hint.label ?? languageLabel(hint.language ?? 'und'),
        };
      });
      this.logger.log(`MP4 container has ${container.length} audio tracks for ${fileName} (ffprobe had ${probe.audioTracks.length}).`);
      return { ...probe, audioTracks };
    } catch (error) {
      this.logger.warn(`MP4 audio enrich failed for ${fileName}: ${error instanceof Error ? error.message : 'error'}`);
      return probe;
    }
  }

  private runFfprobe(absPath: string): Promise<string> {
    const bin = resolveFfprobePath(this.config);
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
      }, 30_000);
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
}
