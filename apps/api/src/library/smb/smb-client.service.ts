import { Injectable, Logger } from '@nestjs/common';
import SMB2 from '@marsaud/smb2';

export type SmbAuth = {
  host: string;
  port?: number;
  username: string;
  password: string;
  domain?: string;
  share: string;
};

export type SmbListedEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  sizeBytes: number | null;
};

const VIDEO_EXT = new Set([
  '.mkv',
  '.mp4',
  '.avi',
  '.mov',
  '.wmv',
  '.m4v',
  '.ts',
  '.m2ts',
  '.webm',
  '.mpg',
  '.mpeg',
]);

@Injectable()
export class SmbClientService {
  private readonly logger = new Logger(SmbClientService.name);

  isVideoFile(name: string): boolean {
    const idx = name.lastIndexOf('.');
    if (idx < 0) return false;
    return VIDEO_EXT.has(name.slice(idx).toLowerCase());
  }

  uncShare(auth: SmbAuth): string {
    return `\\\\${auth.host}\\${auth.share}`;
  }

  private createClient(auth: SmbAuth): SMB2 {
    return new SMB2({
      share: this.uncShare(auth),
      domain: auth.domain?.trim() || 'WORKGROUP',
      username: auth.username,
      password: auth.password,
      port: auth.port ?? 445,
      autoCloseTimeout: 8_000,
    });
  }

  private normalizeRemotePath(input?: string | null): string {
    if (!input) return '';
    return input
      .replace(/\//g, '\\')
      .replace(/^\\+/, '')
      .replace(/\\+$/, '');
  }

  async test(auth: SmbAuth): Promise<void> {
    const client = this.createClient(auth);
    try {
      await client.readdir('');
    } finally {
      try {
        client.disconnect();
      } catch {
        /* ignore */
      }
    }
  }

  async list(auth: SmbAuth, remotePath = ''): Promise<SmbListedEntry[]> {
    const client = this.createClient(auth);
    const base = this.normalizeRemotePath(remotePath);
    try {
      const files = await client.readdir(base, { stats: true });
      const entries: SmbListedEntry[] = [];
      for (const file of files) {
        const name = typeof file === 'string' ? file : file.name;
        if (!name || name === '.' || name === '..') continue;
        const lower = name.toLowerCase();
        if (lower.startsWith('.') || lower === 'thumbs.db' || lower === 'desktop.ini') continue;
        const full = base ? `${base}\\${name}` : name;
        const isDirectory =
          typeof file === 'string'
            ? !name.includes('.')
            : Boolean(file.isDirectory?.());
        entries.push({
          name,
          path: full.replace(/\\/g, '/'),
          isDirectory,
          sizeBytes: null,
        });
      }
      entries.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
      return entries;
    } finally {
      try {
        client.disconnect();
      } catch {
        /* ignore */
      }
    }
  }
}
