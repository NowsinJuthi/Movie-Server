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

  private mountHelperPath(): string {
    const raw = this.config.get<string>('SMB_MOUNT_HELPER');
    const helper = typeof raw === 'string' ? raw.trim() : '';
    return helper || '/usr/local/bin/amarpin-mount-smb';
  }

  private sudoMountEnabled(): boolean {
    const raw = this.config.get<boolean | string>('SMB_MOUNT_USE_SUDO');
    if (raw === undefined || raw === '') return true;
    if (typeof raw === 'boolean') return raw;
    return !/^(0|false|no|off)$/i.test(raw.trim());
  }

  /** CIFS mounts must appear as the API user so uploads/scans can write. */
  private cifsOwnerOptions(): { uid: string; gid: string } {
    const uid = this.config.get<string>('SMB_MOUNT_UID')?.trim();
    const gid = this.config.get<string>('SMB_MOUNT_GID')?.trim();
    if (uid && gid) {
      return { uid, gid };
    }
    return {
      uid: String(process.getuid?.() ?? 0),
      gid: String(process.getgid?.() ?? 0),
    };
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

  /** Drop stale mappings to the same host (Windows error 1219). */
  private async disconnectWindowsHost(host: string): Promise<void> {
    const hostLit = this.psSingleQuote(host);
    const script = [
      "$ErrorActionPreference = 'SilentlyContinue'",
      `Get-SmbMapping | Where-Object { $_.RemotePath -like ('\\\\' + ${hostLit} + '\\*') } | Remove-SmbMapping -Force -UpdateProfile`,
    ].join('; ');
    await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, timeout: 20_000 },
    ).catch(() => undefined);
  }

  private async connectWindows(auth: SmbAuth): Promise<void> {
    const shareUnc = `\\\\${auth.host}\\${auth.share}`;
    const users = this.windowsUserCandidates(auth);

    await this.disconnectWindowsHost(auth.host);
    await execFileAsync('net', ['use', shareUnc, '/delete', '/y'], {
      windowsHide: true,
      timeout: 15_000,
    }).catch(() => undefined);

    let lastError: unknown;
    for (const user of users) {
      try {
        await this.connectWindowsWithCredential(shareUnc, user, auth.password);
        return;
      } catch (error) {
        lastError = error;
      }
    }

    const message = this.formatExecError(lastError);
    this.logger.warn(`Windows SMB map failed for ${shareUnc}: ${message}`);
    throw new Error(message);
  }

  private windowsUserCandidates(auth: SmbAuth): string[] {
    const username = auth.username.trim();
    const domain = (auth.domain ?? '').trim();
    const hostLabel = auth.host.includes('.') ? auth.host.split('.')[0]! : auth.host;
    const candidates = [
      this.windowsUser(auth),
      username,
      `WORKGROUP\\${username}`,
      `${hostLabel}\\${username}`,
      `${auth.host}\\${username}`,
    ];
    if (domain && domain !== '.' && domain.toUpperCase() !== 'WORKGROUP') {
      candidates.unshift(`${domain}\\${username}`);
    }
    return [...new Set(candidates.filter(Boolean))];
  }

  private async connectWindowsWithCredential(
    shareUnc: string,
    user: string,
    password: string,
  ): Promise<void> {
    const remote = this.psSingleQuote(shareUnc);
    const script = [
      "$ErrorActionPreference = 'Stop'",
      `try { Remove-SmbMapping -RemotePath ${remote} -Force -ErrorAction SilentlyContinue } catch {}`,
      '$pass = ConvertTo-SecureString -String $env:AMARPIN_SMB_PASS -AsPlainText -Force',
      '$cred = New-Object System.Management.Automation.PSCredential($env:AMARPIN_SMB_USER, $pass)',
      `New-SmbMapping -RemotePath ${remote} -Credential $cred -Persistent:$false | Out-Null`,
      `if (-not (Test-Path -LiteralPath ${remote})) { throw 'Share mapped but path is not accessible.' }`,
    ].join('; ');

    await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      {
        windowsHide: true,
        timeout: 45_000,
        maxBuffer: 2_000_000,
        env: {
          ...process.env,
          AMARPIN_SMB_USER: user,
          AMARPIN_SMB_PASS: password,
        },
      },
    );
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
    if (!error || typeof error !== 'object') return this.redactSecrets(String(error));
    const err = error as { message?: string; stderr?: Buffer | string; stdout?: Buffer | string };
    const stderr = typeof err.stderr === 'string' ? err.stderr : err.stderr?.toString('utf8') ?? '';
    const stdout = typeof err.stdout === 'string' ? err.stdout : err.stdout?.toString('utf8') ?? '';
    const combined = [stderr, stdout, err.message ?? '']
      .join('\n')
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^At |^\+ |^CategoryInfo|^FullyQualifiedErrorId|^~/i.test(line))
      .filter((line) => !/^Command failed:/i.test(line));
    const useful = combined.find((line) =>
      /denied|logon|password|user|failed|error|access|1219|1326|network|timeout|refused|not found/i.test(
        line,
      ),
    );
    let message = useful || combined[0] || 'Windows SMB authentication failed';
    if (/network path was not found/i.test(message)) {
      message =
        'Network path was not found — Windows cannot reach this host/share. Use the Samba server LAN IP, confirm the share name, ensure Samba is running, and that port 445 is reachable from this PC.';
    }
    if (/multiple connections to a server|error 1219|1219/i.test(message)) {
      message =
        'Windows already has another connection to this server (often a different share or username). Close File Explorer windows to that server, then retry — AmarPin clears old mappings automatically on the next attempt.';
    }
    return this.redactSecrets(message).slice(0, 400);
  }

  private redactSecrets(value: string): string {
    return value
      .replace(/-Password\s+'[^']*'/gi, "-Password '***'")
      .replace(/AMARPIN_SMB_PASS=[^\s]+/gi, 'AMARPIN_SMB_PASS=***')
      .replace(/password=[^\s]+/gi, 'password=***');
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
      try {
        await this.mountLinuxCifs(serverId, auth, source, mountPoint, credFile);
      } catch (error) {
        try {
          await fs.access(full);
          this.logger.warn(`Using pre-mounted Samba path for ${source} at ${mountPoint}`);
        } catch {
          const message = this.formatExecError(error);
          throw new Error(
            `Could not mount ${source} at ${mountPoint}. On systemd VPS run: sudo bash deploy/aapanel/install-smb-mount-helper.sh — then restart amarpin-api. ${message}`,
          );
        }
      } finally {
        await fs.unlink(credFile).catch(() => undefined);
      }
    }

    await fs.access(full);
    return full;
  }

  private isMountPermissionError(error: unknown): boolean {
    const message = this.formatExecError(error).toLowerCase();
    return (
      /permission denied/.test(message) ||
      /operation not permitted/.test(message) ||
      /not permitted/.test(message) ||
      /must be superuser/.test(message)
    );
  }

  private async mountLinuxCifs(
    serverId: string,
    auth: SmbAuth,
    source: string,
    mountPoint: string,
    credFile: string,
  ): Promise<void> {
    try {
      await this.mountLinuxCifsDirect(source, mountPoint, credFile, auth.port);
    } catch (error) {
      if (!this.sudoMountEnabled() || !this.isMountPermissionError(error)) {
        throw error;
      }
      this.logger.log(`Direct CIFS mount denied for ${source}; retrying via sudo helper`);
      await this.mountLinuxCifsViaSudo(serverId, auth, credFile);
    }
  }

  private async mountLinuxCifsDirect(
    source: string,
    mountPoint: string,
    credFile: string,
    port?: number,
  ): Promise<void> {
    const shareSource = port && port !== 445 ? `${source}:${port}` : source;
    const owner = this.cifsOwnerOptions();
    const baseOpts = [
      `credentials=${credFile}`,
      `uid=${owner.uid}`,
      `gid=${owner.gid}`,
      'iocharset=utf8',
      'file_mode=0664',
      'dir_mode=0775',
      'noserverino',
      'sec=ntlmssp',
      'cache=loose',
      'actimeo=60',
    ];
    const versAttempts = ['3.0', '3.1.1', '2.1'];
    let lastError: unknown;
    for (const vers of versAttempts) {
      const options = [...baseOpts, `vers=${vers}`].join(',');
      try {
        await execFileAsync('mount', ['-t', 'cifs', shareSource, mountPoint, '-o', options], {
          timeout: 45_000,
        });
        return;
      } catch (error) {
        lastError = error;
      }
    }
    try {
      await execFileAsync('mount', ['-t', 'cifs', shareSource, mountPoint, '-o', baseOpts.join(',')], {
        timeout: 45_000,
      });
    } catch (error) {
      throw lastError ?? error;
    }
  }

  private async mountLinuxCifsViaSudo(
    serverId: string,
    auth: SmbAuth,
    credFile: string,
  ): Promise<void> {
    const helper = this.mountHelperPath();
    const args = [
      helper,
      serverId,
      auth.host,
      auth.share,
      credFile,
      this.mountRoot(),
      String(auth.port ?? 445),
    ];
    await execFileAsync('sudo', args, { timeout: 45_000 });
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
