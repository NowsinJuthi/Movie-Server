import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';
import type { SmbAuth, SmbListedEntry } from './smb-client.service';

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

  /** Prefer native OS auth on Windows — JS NTLM often fails where Explorer/`net use` works. */
  async testNative(auth: SmbAuth): Promise<void> {
    if (process.platform === 'win32') {
      await this.connectWindows(auth);
      await fs.access(`\\\\${auth.host}\\${auth.share}`);
      return;
    }
    throw new Error('Native SMB test is only available on Windows.');
  }

  /** Linux/Docker: use smbclient — @marsaud/smb2 can crash Node in containers. */
  async testLinux(auth: SmbAuth): Promise<void> {
    if (process.platform === 'win32') {
      throw new Error('Linux SMB test is not available on Windows.');
    }
    try {
      await this.runSmbclient(auth, 'exit');
    } catch (error) {
      throw new Error(this.formatLinuxSmbError(error));
    }
  }

  async listLinux(auth: SmbAuth, remotePath = ''): Promise<SmbListedEntry[]> {
    if (process.platform === 'win32') {
      throw new Error('Linux SMB browse is not available on Windows.');
    }
    const safePath = remotePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    let output: string;
    try {
      output = await this.runSmbclient(auth, 'ls', safePath, false, true);
    } catch (error) {
      throw new Error(this.formatLinuxSmbError(error));
    }
    const entries: SmbListedEntry[] = [];
    for (const line of output.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parsed = this.parseSmbclientLsLine(line);
      if (!parsed) continue;
      const { name, isDirectory } = parsed;
      if (!name || name === '.' || name === '..') continue;
      const lower = name.toLowerCase();
      if (lower.startsWith('.') || lower === 'thumbs.db' || lower === 'desktop.ini') continue;
      const rel = safePath ? `${safePath}/${name}` : name;
      entries.push({
        name,
        path: rel.replace(/\\/g, '/'),
        isDirectory,
        sizeBytes: parsed.sizeBytes,
      });
    }
    entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
    return entries;
  }

  async listNative(auth: SmbAuth, remotePath = ''): Promise<SmbListedEntry[]> {
    if (process.platform !== 'win32') {
      throw new Error('Native SMB browse is only available on Windows.');
    }
    await this.connectWindows(auth);
    const full = this.uncPath(auth, remotePath);
    const dirents = await fs.readdir(full, { withFileTypes: true });
    const base = remotePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const entries: SmbListedEntry[] = [];
    for (const dirent of dirents) {
      const name = dirent.name;
      if (!name || name === '.' || name === '..') continue;
      const lower = name.toLowerCase();
      if (lower.startsWith('.') || lower === 'thumbs.db' || lower === 'desktop.ini') continue;
      const isDirectory = dirent.isDirectory();
      const rel = base ? `${base}/${name}` : name;
      entries.push({
        name,
        path: rel.replace(/\\/g, '/'),
        isDirectory,
        sizeBytes: null,
      });
    }
    entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
    return entries;
  }

  private async ensureWindows(auth: SmbAuth, remotePath: string): Promise<string> {
    await this.connectWindows(auth);
    const full = this.uncPath(auth, remotePath);
    await fs.access(full);
    return full;
  }

  private windowsUser(auth: SmbAuth): string {
    const domain = (auth.domain ?? '').trim();
    if (!domain || domain === '.' || domain.toUpperCase() === 'WORKGROUP') {
      return auth.username;
    }
    return `${domain}\\${auth.username}`;
  }

  private async connectWindows(auth: SmbAuth): Promise<void> {
    const shareUnc = `\\\\${auth.host}\\${auth.share}`;
    const user = this.windowsUser(auth);

    // Drop stale mappings so Windows does not return System error 1219.
    await execFileAsync('net', ['use', shareUnc, '/delete', '/y'], {
      windowsHide: true,
      timeout: 15_000,
    }).catch(() => undefined);

    const remote = this.psSingleQuote(shareUnc);
    const userLit = this.psSingleQuote(user);
    const passLit = this.psSingleQuote(auth.password);
    const script = [
      "$ErrorActionPreference = 'Stop'",
      `try { Remove-SmbMapping -RemotePath ${remote} -Force -ErrorAction SilentlyContinue } catch {}`,
      `New-SmbMapping -RemotePath ${remote} -UserName ${userLit} -Password ${passLit} -Persistent:$false | Out-Null`,
      `if (-not (Test-Path -LiteralPath ${remote})) { throw 'Share mapped but path is not accessible.' }`,
    ].join('; ');

    try {
      await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
        { windowsHide: true, timeout: 45_000, maxBuffer: 2_000_000 },
      );
    } catch (error) {
      const message = this.formatExecError(error);
      this.logger.warn(`Windows SMB map failed for ${shareUnc} as ${user}: ${message}`);
      throw new Error(message);
    }
  }

  private psSingleQuote(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
  }

  private linuxShareUrl(auth: SmbAuth): string {
    return `//${auth.host}/${auth.share}`;
  }

  private linuxUserSpec(auth: SmbAuth): string {
    const domain = (auth.domain ?? '').trim();
    if (domain && domain !== '.' && domain.toUpperCase() !== 'WORKGROUP') {
      return `${domain}/${auth.username}`;
    }
    return auth.username;
  }

  private async runSmbclient(
    auth: SmbAuth,
    command: string,
    remotePath = '',
    grepable = false,
    stdoutOnly = false,
  ): Promise<string> {
    const args = [
      this.linuxShareUrl(auth),
      '-U',
      this.linuxUserSpec(auth),
      `--password=${auth.password}`,
      '-p',
      String(auth.port ?? 445),
      '-m',
      'SMB3',
    ];
    const domain = (auth.domain ?? '').trim();
    if (domain && domain !== '.' && domain.toUpperCase() !== 'WORKGROUP') {
      args.push('-W', domain);
    }
    if (grepable) args.push('-g');
    const cleaned = remotePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (cleaned) args.push('-D', cleaned);
    args.push('-c', command);
    const { stdout, stderr } = await execFileAsync('smbclient', args, {
      timeout: 45_000,
      maxBuffer: 4_000_000,
    });
    const out = this.decodeExecOutput(stdout);
    if (stdoutOnly) {
      return out;
    }
    const err = this.decodeExecOutput(stderr);
    return [out, err].filter(Boolean).join('\n');
  }

  private decodeExecOutput(value: string | Buffer | undefined): string {
    if (value === undefined || value === null) return '';
    return typeof value === 'string' ? value : value.toString('utf8');
  }

  /** smbclient `ls` human-readable lines (grepable -g does not apply to dir listings). */
  private parseSmbclientLsLine(
    line: string,
  ): { name: string; isDirectory: boolean; sizeBytes: number | null } | null {
    if (/blocks of size|blocks available|^Domain=\[/i.test(line)) return null;
    const human = line.match(
      /^\s{2}(.+?)\s+([ADHSR]+)\s+(\d+)\s+\w{3}\s+\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\d{4}\s*$/,
    );
    if (human) {
      const name = human[1].trim();
      const modes = human[2];
      const size = Number(human[3]);
      return {
        name,
        isDirectory: modes.includes('D'),
        sizeBytes: Number.isFinite(size) ? size : null,
      };
    }
    return this.parseGrepableSmbLine(line.trim());
  }

  private parseGrepableSmbLine(
    line: string,
  ): { name: string; isDirectory: boolean; sizeBytes: number | null } | null {
    const quoted = line.match(/^"((?:[^"\\]|\\.)*)"\|([a-zA-Z])\|(\d+)\|/);
    if (quoted) {
      const name = quoted[1].replace(/\\"/g, '"').trim();
      const type = quoted[2].toLowerCase();
      const size = Number(quoted[3]);
      return {
        name,
        isDirectory: type === 'd',
        sizeBytes: Number.isFinite(size) ? size : null,
      };
    }
    const plain = line.match(/^([^|]+)\|([a-zA-Z])\|(\d+)\|/);
    if (!plain) return null;
    const type = plain[2].toLowerCase();
    const size = Number(plain[3]);
    return {
      name: plain[1].trim(),
      isDirectory: type === 'd',
      sizeBytes: Number.isFinite(size) ? size : null,
    };
  }

  private formatLinuxSmbError(error: unknown): string {
    const raw = this.formatExecError(error);
    const nt = raw.match(/NT_STATUS_[A-Z_]+/)?.[0];
    if (nt === 'NT_STATUS_LOGON_FAILURE') {
      return 'Login failure — wrong username or password.';
    }
    if (nt === 'NT_STATUS_ACCESS_DENIED') {
      return 'Access denied.';
    }
    if (nt) {
      return nt
        .replace(/^NT_STATUS_/, '')
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/^\w/, (c) => c.toUpperCase());
    }
    return raw.slice(0, 400);
  }

  private formatExecError(error: unknown): string {
    if (!error || typeof error !== 'object') return String(error);
    const err = error as { message?: string; stderr?: Buffer | string; stdout?: Buffer | string };
    const stderr = typeof err.stderr === 'string' ? err.stderr : err.stderr?.toString('utf8') ?? '';
    const stdout = typeof err.stdout === 'string' ? err.stdout : err.stdout?.toString('utf8') ?? '';
    const combined = [stderr, stdout, err.message ?? '']
      .join('\n')
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^At |^\+ |^CategoryInfo|^FullyQualifiedErrorId|^~/i.test(line));
    const useful = combined.find((line) => /denied|logon|password|user|failed|error|access/i.test(line));
    return (useful || combined[0] || err.message || 'Windows SMB authentication failed').slice(0, 400);
  }

  private async writeLinuxCredentialsFile(auth: SmbAuth): Promise<string> {
    const credDir = path.join(this.mountRoot(), '.credentials');
    await fs.mkdir(credDir, { recursive: true, mode: 0o700 });
    const credFile = path.join(credDir, `${randomBytes(12).toString('hex')}.cred`);
    const domain = (auth.domain ?? '').trim() || 'WORKGROUP';
    await fs.writeFile(
      credFile,
      `username=${auth.username}\npassword=${auth.password}\ndomain=${domain}\n`,
      { mode: 0o600 },
    );
    return credFile;
  }

  private async ensureLinux(serverId: string, auth: SmbAuth, remotePath: string): Promise<string> {
    const mountPoint = this.linuxMountPoint(serverId);
    await fs.mkdir(mountPoint, { recursive: true });
    const source = `//${auth.host}/${auth.share}`;
    const cleaned = remotePath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
    const full = cleaned ? path.join(mountPoint, ...cleaned.split('/')) : mountPoint;

    const alreadyMounted = await this.isMounted(mountPoint);
    if (!alreadyMounted) {
      const credFile = await this.writeLinuxCredentialsFile(auth);
      const options = [
        `credentials=${credFile}`,
        'uid=0',
        'gid=0',
        'iocharset=utf8',
        'file_mode=0644',
        'dir_mode=0755',
        'vers=3.0',
        'noserverino',
      ].join(',');
      try {
        await execFileAsync('mount', ['-t', 'cifs', source, mountPoint, '-o', options], {
          timeout: 45_000,
        });
      } catch (error) {
        try {
          await fs.access(full);
          this.logger.warn(`Using pre-mounted Samba path for ${source} at ${mountPoint}`);
        } catch {
          const message = this.formatExecError(error);
          throw new Error(
            `Could not mount ${source}. The API container needs CIFS mount permission (cap SYS_ADMIN), or pre-mount the share on the host under ${mountPoint}. ${message}`,
          );
        }
      } finally {
        await fs.unlink(credFile).catch(() => undefined);
      }
    }

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
