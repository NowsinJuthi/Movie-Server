import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { sniffImageMime } from '../common/security/image-bytes';

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

@Injectable()
export class AvatarsService {
  private readonly logger = new Logger(AvatarsService.name);

  constructor(private readonly config: ConfigService) {}

  rootDir(): string {
    if (this.config.get('NODE_ENV') === 'test') {
      return path.join(os.tmpdir(), 'cinevault-avatars');
    }
    return (
      this.config.get<string>('AVATAR_UPLOAD_DIR') ||
      path.join(process.cwd(), 'storage', 'uploads', 'avatars')
    );
  }

  maxBytes(): number {
    return this.config.get<number>('AVATAR_MAX_BYTES') ?? 2 * 1024 * 1024;
  }

  isAllowed(mime: string): boolean {
    return mime in ALLOWED_MIME;
  }

  async save(userId: string, file: { mimetype: string; buffer: Buffer }): Promise<string> {
    const mime = sniffImageMime(file.buffer);
    if (!mime || mime !== file.mimetype) {
      throw new Error('Avatar bytes do not match an allowed image type.');
    }
    const ext = ALLOWED_MIME[mime];
    const fileName = `${randomBytes(16).toString('hex')}${ext}`;
    const dir = path.join(this.rootDir(), userId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, fileName), file.buffer);
    return fileName;
  }

  async remove(userId: string, fileName?: string | null): Promise<void> {
    if (!fileName) {
      return;
    }
    const full = path.join(this.rootDir(), userId, path.basename(fileName));
    try {
      await fs.unlink(full);
    } catch (error) {
      this.logger.debug(`Avatar already removed: ${full}`);
      void error;
    }
  }

  resolveFile(userId: string, fileName: string): string {
    const safeUser = path.basename(userId);
    const safeFile = path.basename(fileName);
    return path.join(this.rootDir(), safeUser, safeFile);
  }
}
