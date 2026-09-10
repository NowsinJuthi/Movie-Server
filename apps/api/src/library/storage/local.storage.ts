import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { isInsideRoot, resolveSafePath, toPosixRelative, UnsafePathError } from './path-safety';
import { StorageFile, StorageProvider } from './storage.types';

const SKIP_NAMES = new Set(['.ds_store', 'thumbs.db', 'desktop.ini']);
const SKIP_PREFIXES = ['.', '@eadir', '#recycle'];

export class LocalStorageProvider implements StorageProvider {
  readonly kind = 'local' as const;

  constructor(private readonly root: string) {}

  resolveSafe(key: string): string {
    return resolveSafePath(this.root, key);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.stat(this.resolveSafe(key));
      return true;
    } catch {
      return false;
    }
  }

  async stat(key: string): Promise<StorageFile | null> {
    try {
      const full = this.resolveSafe(key);
      const info = await fs.stat(full);
      if (!info.isFile()) {
        return null;
      }
      return { key: toPosixRelative(key), sizeBytes: info.size, mtimeMs: info.mtimeMs };
    } catch {
      return null;
    }
  }

  async openReadStream(key: string, range?: { start: number; end: number }): Promise<Readable> {
    const full = this.resolveSafe(key);
    if (range) {
      return createReadStream(full, { start: range.start, end: range.end });
    }
    return createReadStream(full);
  }

  async list(prefix = ''): Promise<StorageFile[]> {
    const start = prefix ? this.resolveSafe(prefix) : path.resolve(this.root);
    const files: StorageFile[] = [];
    await this.walk(start, files);
    return files;
  }

  private async walk(dir: string, out: StorageFile[]): Promise<void> {
    let entries: import('fs').Dirent[] = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (!isInsideRoot(this.root, full)) {
        continue;
      }
      const lower = entry.name.toLowerCase();
      if (SKIP_NAMES.has(lower) || SKIP_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
        continue;
      }
      try {
        const lstat = await fs.lstat(full);
        if (lstat.isSymbolicLink()) {
          const real = await fs.realpath(full);
          if (!isInsideRoot(this.root, real)) {
            continue;
          }
        }
        if (lstat.isDirectory() || (lstat.isSymbolicLink() && (await fs.stat(full)).isDirectory())) {
          await this.walk(full, out);
          continue;
        }
        if (!lstat.isFile() && !(lstat.isSymbolicLink() && (await fs.stat(full)).isFile())) {
          continue;
        }
        const info = lstat.isFile() ? lstat : await fs.stat(full);
        const relative = toPosixRelative(path.relative(this.root, full));
        if (!relative || relative.includes('..')) {
          continue;
        }
        out.push({ key: relative, sizeBytes: info.size, mtimeMs: info.mtimeMs });
      } catch (error) {
        if (error instanceof UnsafePathError) {
          continue;
        }
      }
    }
  }
}
