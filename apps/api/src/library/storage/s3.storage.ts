import { Readable } from 'stream';
import { BadRequestException } from '@nestjs/common';
import { ErrorCode } from '@movie-server/shared';
import { StorageFile, StorageProvider } from './storage.types';

export class S3StorageProvider implements StorageProvider {
  readonly kind = 's3' as const;

  constructor(_bucket?: string) {
    void _bucket;
  }

  private notImplemented(): never {
    throw new BadRequestException({
      error: ErrorCode.StorageNotImplemented,
      message: 'Object storage is not configured yet.',
    });
  }

  list(): Promise<StorageFile[]> {
    this.notImplemented();
  }

  stat(): Promise<StorageFile | null> {
    this.notImplemented();
  }

  exists(): Promise<boolean> {
    this.notImplemented();
  }

  openReadStream(): Promise<Readable> {
    this.notImplemented();
  }

  resolveSafe(): string {
    this.notImplemented();
  }
}
