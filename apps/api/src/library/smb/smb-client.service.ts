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
    // Preserve empty domain when provided — forcing WORKGROUP breaks many
    // Ubuntu Samba / local Windows account logons.
    const domain =
      auth.domain === undefined || auth.domain === null
        ? 'WORKGROUP'
        : auth.domain.trim();
    return new SMB2({
      share: this.uncShare(auth),
      domain: domain || '.',
      username: auth.username,
      password: auth.password,
      port: auth.port ?? 445,
      autoCloseTimeout: 15_000,
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
    await this.withClient(auth, async (client) => {
      await client.readdir('');
    });
  }

  async list(auth: SmbAuth, remotePath = ''): Promise<SmbListedEntry[]> {
    const base = this.normalizeRemotePath(remotePath);
    return this.withClient(auth, async (client) => {
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
    });
  }

  private async withClient<T>(auth: SmbAuth, run: (client: SMB2) => Promise<T>): Promise<T> {
    let client: SMB2 | null = null;
    try {
      client = this.createClient(auth);
      return await run(client);
    } catch (error) {
      const message = this.formatClientError(error);
      this.logger.warn(`SMB error for \\\\${auth.host}\\${auth.share}: ${message}`);
      throw new Error(message);
    } finally {
      if (client) {
        try {
          client.disconnect();
        } catch {
          /* ignore */
        }
      }
    }
  }

  private formatClientError(error: unknown): string {
    if (error instanceof Error) {
      if (/unsupported|ERR_OSSL_EVP_UNSUPPORTED|digital envelope/i.test(error.message)) {
        return 'SMB/NTLM crypto is blocked by this Node.js OpenSSL build. Restart the API with NODE_OPTIONS=--openssl-legacy-provider.';
      }
      return error.message || 'SMB request failed';
    }
    if (typeof error === 'string' && error.trim()) return error.trim();
    return 'SMB request failed';
  }
}
