import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { ErrorCode } from '@movie-server/shared';
import { sniffImageMime } from '../common/security/image-bytes';

const EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico',
  'image/svg+xml': '.svg',
};

function sniffBrandingMime(buffer: Buffer, declared?: string): string | null {
  const image = sniffImageMime(buffer);
  if (image) return image;

  // ICO: 00 00 01 00
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x00 &&
    buffer[1] === 0x00 &&
    buffer[2] === 0x01 &&
    buffer[3] === 0x00
  ) {
    return 'image/x-icon';
  }

  const head = buffer.subarray(0, Math.min(buffer.length, 256)).toString('utf8').trimStart();
  if (head.startsWith('<svg') || head.startsWith('<?xml')) {
    if (head.includes('<svg')) return 'image/svg+xml';
  }

  if (declared && declared in EXT) {
    // Allow declared ico/svg only when bytes sniff failed but type is explicit for tiny files
    if (declared === 'image/svg+xml' || declared === 'image/x-icon' || declared === 'image/vnd.microsoft.icon') {
      return declared;
    }
  }
  return null;
}

export function isBrandingKey(key: string): boolean {
  return /^[a-f0-9]{32}\.(jpg|png|webp|ico|svg)$/i.test(key);
}

@Injectable()
export class BrandingStorageService {
  private readonly logger = new Logger(BrandingStorageService.name);

  constructor(private readonly config: ConfigService) {}

  rootDir(): string {
    if (this.config.get('NODE_ENV') === 'test') {
      return path.join(os.tmpdir(), 'amarpin-branding');
    }
    return (
      this.config.get<string>('BRANDING_UPLOAD_DIR') ||
      path.join(process.cwd(), 'storage', 'uploads', 'branding')
    );
  }

  maxBytes(): number {
    return this.config.get<number>('BRANDING_MAX_BYTES') ?? 2 * 1024 * 1024;
  }

  async save(file: { mimetype: string; buffer: Buffer }): Promise<string> {
    const mime = sniffBrandingMime(file.buffer, file.mimetype);
    if (!mime || !(mime in EXT)) {
      throw new Error('File must be JPEG, PNG, WebP, ICO, or SVG.');
    }
    const key = `${randomBytes(16).toString('hex')}${EXT[mime]}`;
    await fs.mkdir(this.rootDir(), { recursive: true });
    await fs.writeFile(this.resolve(key), file.buffer);
    return key;
  }

  async remove(key?: string | null): Promise<void> {
    if (!key || !isBrandingKey(key)) return;
    try {
      await fs.unlink(this.resolve(key));
    } catch (error) {
      this.logger.debug(`Branding asset already removed: ${key}`);
      void error;
    }
  }

  resolve(key: string): string {
    return path.join(this.rootDir(), path.basename(key));
  }

  async open(key: string): Promise<{ stream: ReturnType<typeof createReadStream>; mime: string }> {
    if (!isBrandingKey(key)) {
      throw new NotFoundException({ error: ErrorCode.NotFound, message: 'Not found.' });
    }
    const fullPath = this.resolve(key);
    try {
      await fs.stat(fullPath);
    } catch {
      throw new NotFoundException({ error: ErrorCode.NotFound, message: 'Not found.' });
    }
    const lower = key.toLowerCase();
    const mime = lower.endsWith('.png')
      ? 'image/png'
      : lower.endsWith('.webp')
        ? 'image/webp'
        : lower.endsWith('.ico')
          ? 'image/x-icon'
          : lower.endsWith('.svg')
            ? 'image/svg+xml'
            : 'image/jpeg';
    return { stream: createReadStream(fullPath), mime };
  }
}
