import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { ErrorCode } from '@movie-server/shared';
import { isArtworkKey } from './movie.util';
import { sniffImageMime } from '../common/security/image-bytes';

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

@Injectable()
export class ArtworkStorageService {
  private readonly logger = new Logger(ArtworkStorageService.name);

  constructor(private readonly config: ConfigService) {}

  rootDir(): string {
    if (this.config.get('NODE_ENV') === 'test') {
      return path.join(os.tmpdir(), 'amarpin-artwork');
    }
    return (
      this.config.get<string>('ARTWORK_UPLOAD_DIR') ||
      path.join(process.cwd(), 'storage', 'uploads', 'artwork')
    );
  }

  maxBytes(): number {
    return this.config.get<number>('ARTWORK_MAX_BYTES') ?? 5 * 1024 * 1024;
  }

  isAllowed(mime: string): boolean {
    return mime in ALLOWED_MIME;
  }

  async save(file: { mimetype: string; buffer: Buffer }): Promise<string> {
    const mime = sniffImageMime(file.buffer);
    if (!mime || (file.mimetype && file.mimetype !== mime) || !(mime in ALLOWED_MIME)) {
      throw new Error('Artwork bytes do not match an allowed image type.');
    }
    const ext = ALLOWED_MIME[mime];
    const key = `${randomBytes(16).toString('hex')}${ext}`;
    await fs.mkdir(this.rootDir(), { recursive: true });
    await fs.writeFile(this.resolve(key), file.buffer);
    return key;
  }

  async remove(key?: string | null): Promise<void> {
    if (!key || !isArtworkKey(key)) {
      return;
    }
    try {
      await fs.unlink(this.resolve(key));
    } catch (error) {
      this.logger.debug(`Artwork already removed: ${key}`);
      void error;
    }
  }

  resolve(key: string): string {
    const safe = path.basename(key);
    return path.join(this.rootDir(), safe);
  }

  async exists(key?: string | null): Promise<boolean> {
    if (!key || !isArtworkKey(key)) {
      return false;
    }
    try {
      const stat = await fs.stat(this.resolve(key));
      return stat.isFile() && stat.size > 0;
    } catch {
      return false;
    }
  }

  async open(key: string): Promise<{ stream: ReturnType<typeof createReadStream>; mime: string }> {
    if (!isArtworkKey(key)) {
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
        : 'image/jpeg';
    return { stream: createReadStream(fullPath), mime };
  }
}
