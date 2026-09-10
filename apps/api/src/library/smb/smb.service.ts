import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ErrorCode, LibraryKind, StorageProviderKind } from '@movie-server/shared';
import { LibraryService } from '../library.service';
import { MediaLibrary, MediaLibraryDocument } from '../schemas/media-library.schema';
import { SmbCredentialCrypto } from './smb-credential.crypto';
import { SmbClientService, type SmbAuth } from './smb-client.service';
import { SmbMountService } from './smb-mount.service';
import { SmbServer, SmbServerDocument } from './schemas/smb-server.schema';
import { AddSmbLibraryDto, UpdateSmbServerDto, UpsertSmbServerDto } from './dto/smb.dto';
import { toAdminSmbServer } from './smb.mapper';

@Injectable()
export class SmbService implements OnModuleInit {
  private readonly logger = new Logger(SmbService.name);

  constructor(
    @InjectModel(SmbServer.name) private readonly servers: Model<SmbServerDocument>,
    @InjectModel(MediaLibrary.name) private readonly libraries: Model<MediaLibraryDocument>,
    private readonly crypto: SmbCredentialCrypto,
    private readonly client: SmbClientService,
    private readonly mounts: SmbMountService,
    private readonly libraryService: LibraryService,
  ) {}

  async onModuleInit(): Promise<void> {
    const docs = await this.servers.find({ enabled: true }).select('+passwordEnc');
    for (const server of docs) {
      try {
        const auth = this.toAuth(server);
        await this.mounts.ensureAccessible(String(server._id), auth, '');
        server.lastOkAt = new Date();
        server.lastError = null;
        await server.save();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`SMB remount failed for ${server.name}: ${message}`);
        server.lastError = message.slice(0, 500);
        await server.save();
      }
    }
  }

  async list() {
    const docs = await this.servers.find().sort({ name: 1 });
    return { servers: docs.map(toAdminSmbServer) };
  }

  async create(dto: UpsertSmbServerDto) {
    const auth = this.authFromDto(dto);
    await this.tryConnect(auth);
    const server = await this.servers.create({
      name: dto.name,
      host: dto.host.trim(),
      port: dto.port ?? 445,
      username: dto.username.trim(),
      passwordEnc: this.crypto.encrypt(dto.password),
      domain: dto.domain?.trim() || 'WORKGROUP',
      share: dto.share.trim(),
      enabled: dto.enabled ?? true,
      lastOkAt: new Date(),
      lastError: null,
    });
    try {
      await this.mounts.ensureAccessible(String(server._id), auth, '');
    } catch (error) {
      this.logger.warn(
        `SMB browse OK but OS mount pending for ${server.name}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
    return { server: toAdminSmbServer(server) };
  }

  async update(id: string, dto: UpdateSmbServerDto) {
    const server = await this.requireServer(id, true);
    if (dto.name) server.name = dto.name;
    if (dto.host) server.host = dto.host.trim();
    if (dto.port) server.port = dto.port;
    if (dto.username) server.username = dto.username.trim();
    if (dto.password) server.passwordEnc = this.crypto.encrypt(dto.password);
    if (dto.domain !== undefined) server.domain = dto.domain.trim() || 'WORKGROUP';
    if (dto.share) server.share = dto.share.trim();
    if (dto.enabled !== undefined) server.enabled = dto.enabled;

    const auth = this.toAuth(server);
    await this.tryConnect(auth);
    server.lastOkAt = new Date();
    server.lastError = null;
    await server.save();
    return { server: toAdminSmbServer(server) };
  }

  async remove(id: string) {
    const server = await this.requireServer(id);
    const linked = await this.libraries.countDocuments({ smbServerId: server._id });
    if (linked > 0) {
      throw new BadRequestException({
        error: ErrorCode.Conflict,
        message: 'Disconnect or remove media libraries that use this Samba server first.',
      });
    }
    await server.deleteOne();
    return { deleted: true };
  }

  async test(id: string) {
    const server = await this.requireServer(id, true);
    try {
      await this.tryConnect(this.toAuth(server));
      server.lastOkAt = new Date();
      server.lastError = null;
      await server.save();
      return { ok: true, message: 'Connected successfully.', server: toAdminSmbServer(server) };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed.';
      server.lastError = message.slice(0, 500);
      await server.save();
      throw new BadRequestException({
        error: ErrorCode.SmbConnectionFailed,
        message,
      });
    }
  }

  async browse(id: string, remotePath = '') {
    const server = await this.requireServer(id, true);
    const auth = this.toAuth(server);
    const safePath = this.sanitizeRemotePath(remotePath);
    try {
      const listed = await this.client.list(auth, safePath);
      server.lastOkAt = new Date();
      server.lastError = null;
      await server.save();
      const parent =
        safePath === ''
          ? null
          : safePath.includes('/')
            ? safePath.split('/').slice(0, -1).join('/')
            : '';
      return {
        serverId: String(server._id),
        share: server.share,
        path: safePath,
        parentPath: parent,
        entries: listed.map((entry) => ({
          name: entry.name,
          path: entry.path,
          kind: entry.isDirectory ? ('directory' as const) : ('file' as const),
          sizeBytes: entry.sizeBytes,
          isVideo: !entry.isDirectory && this.client.isVideoFile(entry.name),
        })),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Browse failed.';
      server.lastError = message.slice(0, 500);
      await server.save();
      throw new BadRequestException({
        error: ErrorCode.SmbConnectionFailed,
        message,
      });
    }
  }

  async addLibrary(dto: AddSmbLibraryDto) {
    const server = await this.requireServer(dto.serverId, true);
    const auth = this.toAuth(server);
    const remotePath = this.sanitizeRemotePath(dto.path);
    // Verify remote path exists via SMB first
    const parent = remotePath.includes('/')
      ? remotePath.split('/').slice(0, -1).join('/')
      : '';
    const leaf = remotePath.includes('/') ? remotePath.split('/').pop()! : remotePath;
    if (remotePath) {
      const siblings = await this.client.list(auth, parent);
      const hit = siblings.find((entry) => entry.name === leaf);
      if (!hit?.isDirectory) {
        throw new BadRequestException({
          error: ErrorCode.InvalidLibraryPath,
          message: 'Select a directory on the Samba share.',
        });
      }
    }

    const rootPath = await this.mounts.ensureAccessible(String(server._id), auth, remotePath);
    const library = await this.libraryService.createFromExternalRoot({
      name: dto.name,
      kind: dto.kind as LibraryKind,
      rootPath,
      provider: StorageProviderKind.Smb,
      smbServerId: String(server._id),
      smbShare: server.share,
      smbRemotePath: remotePath || '',
    });
    return library;
  }

  private sanitizeRemotePath(input?: string | null): string {
    const raw = (input ?? '').trim();
    if (!raw) return '';
    if (raw.includes('\0') || raw.includes('..')) {
      throw new BadRequestException({
        error: ErrorCode.InvalidLibraryPath,
        message: 'Invalid Samba path.',
      });
    }
    return raw.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  }

  private authFromDto(dto: UpsertSmbServerDto | (UpdateSmbServerDto & { password: string })): SmbAuth {
    return {
      host: dto.host!.trim(),
      port: dto.port ?? 445,
      username: dto.username!.trim(),
      password: dto.password,
      domain: dto.domain?.trim() || 'WORKGROUP',
      share: dto.share!.trim(),
    };
  }

  private toAuth(server: SmbServerDocument): SmbAuth {
    return {
      host: server.host,
      port: server.port,
      username: server.username,
      password: this.crypto.decrypt(server.passwordEnc),
      domain: server.domain,
      share: server.share,
    };
  }

  private async tryConnect(auth: SmbAuth): Promise<void> {
    try {
      await this.client.test(auth);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed.';
      throw new BadRequestException({
        error: ErrorCode.SmbConnectionFailed,
        message: `Samba connection failed: ${message}`,
      });
    }
  }

  private async requireServer(id: string, withSecret = false): Promise<SmbServerDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException({ error: ErrorCode.SmbNotFound, message: 'Samba server not found.' });
    }
    const query = this.servers.findById(id);
    if (withSecret) query.select('+passwordEnc');
    const server = await query;
    if (!server) {
      throw new NotFoundException({ error: ErrorCode.SmbNotFound, message: 'Samba server not found.' });
    }
    return server;
  }
}
