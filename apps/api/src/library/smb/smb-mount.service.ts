import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';
import type { SmbAuth } from './smb-client.service';

const execFileAsync = promisify(execFile);

@Injectable()
export class SmbMountService {
  private readonly logger = new Logger(SmbMountService.name);

  constructor(private readonly config: ConfigService) {}

  private mountRoot(): string {
    return (
      this.config.get<string>('SMB_MOUNT_ROOT') ||
      path.join(process.cwd(), 'storage', 'smb-mounts')
    );
  }

  uncPath(auth: SmbAuth, remotePath = ''): string {
    const share = `\\\\${auth.host}\\${auth.share}`;
    const cleaned = remotePath.replace(/\//g, '\\').replace(/^\\+/, '').replace(/\\+$/, '');
    return cleaned ? `${share}\\${cleaned}` : share;
  }

  linuxMountPoint(serverId: string): string {
    return path.join(this.mountRoot(), serverId);
  }

  /**
   * Ensure the OS can access the share for Node fs / ffprobe / scan.
   * Returns a local absolute path (UNC on Windows, cifs mount on Linux).
   */
  async ensureAccessible(serverId: string, auth: SmbAuth, remotePath = ''): Promise<string> {
    if (process.platform === 'win32') {
      return this.ensureWindows(auth, remotePath);
    }
    return this.ensureLinux(serverId, auth, remotePath);
  }

  private async ensureWindows(auth: SmbAuth, remotePath: string): Promise<string> {
    const shareUnc = `\\\\${auth.host}\\${auth.share}`;
    const user = auth.domain && auth.domain !== 'WORKGROUP' ? `${auth.domain}\\${auth.username}` : auth.username;
    try {
      await execFileAsync(
        'net',
        ['use', shareUnc, auth.password, `/user:${user}`, '/persistent:no'],
        { windowsHide: true, timeout: 30_000 },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Already connected is fine
      if (!/already|1219|85/i.test(message)) {
        this.logger.warn(`net use warning for ${shareUnc}: ${message}`);
        // Retry without password if session exists
        try {
          await fs.access(shareUnc);
        } catch {
          throw new Error(
            `Could not connect to ${shareUnc}. Check IP, share name, username and password. ${message}`,
          );
        }
      }
    }
    const full = this.uncPath(auth, remotePath);
    await fs.access(full);
    return full;
  }

  private async ensureLinux(serverId: string, auth: SmbAuth, remotePath: string): Promise<string> {
    const mountPoint = this.linuxMountPoint(serverId);
    await fs.mkdir(mountPoint, { recursive: true });
    const source = `//${auth.host}/${auth.share}`;
    const options = [
      `username=${auth.username}`,
      `password=${auth.password}`,
      `domain=${auth.domain || 'WORKGROUP'}`,
      'uid=0',
      'gid=0',
      'iocharset=utf8',
      'file_mode=0644',
      'dir_mode=0755',
      'vers=3.0',
    ].join(',');

    const alreadyMounted = await this.isMounted(mountPoint);
    if (!alreadyMounted) {
      try {
        await execFileAsync('mount', ['-t', 'cifs', source, mountPoint, '-o', options], {
          timeout: 45_000,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Could not mount ${source}. On Ubuntu the API process needs permission to mount CIFS (or pre-mount the share). ${message}`,
        );
      }
    }

    const cleaned = remotePath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
    const full = cleaned ? path.join(mountPoint, ...cleaned.split('/')) : mountPoint;
    await fs.access(full);
    return full;
  }

  private async isMounted(mountPoint: string): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync('findmnt', ['-n', mountPoint], { timeout: 5_000 });
      return Boolean(stdout.trim());
    } catch {
      try {
        const entries = await fs.readdir(mountPoint);
        return entries.length > 0;
      } catch {
        return false;
      }
    }
  }
}
