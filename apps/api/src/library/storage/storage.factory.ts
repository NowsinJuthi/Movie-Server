import { Injectable } from '@nestjs/common';
import { StorageProviderKind } from '@movie-server/shared';
import { LocalStorageProvider } from './local.storage';
import { S3StorageProvider } from './s3.storage';
import { StorageProvider } from './storage.types';

@Injectable()
export class StorageFactory {
  create(provider: StorageProviderKind, rootPath: string): StorageProvider {
    if (provider === StorageProviderKind.S3) {
      return new S3StorageProvider(rootPath);
    }
    return new LocalStorageProvider(rootPath);
  }
}
