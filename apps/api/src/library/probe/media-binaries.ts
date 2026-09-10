import { existsSync } from 'fs';
import { ConfigService } from '@nestjs/config';

function tryRequirePath(moduleName: string, pick: (mod: unknown) => string | null): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(moduleName) as unknown;
    const path = pick(mod);
    return path && existsSync(path) ? path : null;
  } catch {
    return null;
  }
}

export function resolveFfprobePath(config: ConfigService): string {
  const configured = config.get<string>('FFPROBE_PATH');
  if (configured && configured !== 'ffprobe' && existsSync(configured)) {
    return configured;
  }
  const fromStatic = tryRequirePath('ffprobe-static', (mod) => {
    const value = mod as { path?: string } | string;
    return typeof value === 'string' ? value : value.path ?? null;
  });
  return fromStatic || configured || 'ffprobe';
}

export function resolveFfmpegPath(config: ConfigService): string {
  const configured = config.get<string>('FFMPEG_PATH');
  if (configured && configured !== 'ffmpeg' && existsSync(configured)) {
    return configured;
  }
  const fromStatic = tryRequirePath('ffmpeg-static', (mod) => (typeof mod === 'string' ? mod : null));
  return fromStatic || configured || 'ffmpeg';
}
