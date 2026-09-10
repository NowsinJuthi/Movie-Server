import { Readable } from 'stream';

export type StorageKind = 'local' | 's3';

export type StorageFile = {
  key: string;
  sizeBytes: number;
  mtimeMs: number;
};

export interface StorageProvider {
  readonly kind: StorageKind;
  list(prefix?: string): Promise<StorageFile[]>;
  stat(key: string): Promise<StorageFile | null>;
  exists(key: string): Promise<boolean>;
  openReadStream(key: string, range?: { start: number; end: number }): Promise<Readable>;
  resolveSafe(key: string): string;
}
