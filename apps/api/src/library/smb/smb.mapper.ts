import type { AdminSmbServer } from '@movie-server/shared';
import type { SmbServerDocument } from './schemas/smb-server.schema';

export function toAdminSmbServer(server: SmbServerDocument): AdminSmbServer {
  return {
    id: String(server._id),
    name: server.name,
    host: server.host,
    port: server.port,
    username: server.username,
    domain: server.domain,
    share: server.share,
    enabled: server.enabled,
    lastOkAt: server.lastOkAt ? server.lastOkAt.toISOString() : null,
    lastError: server.lastError ?? null,
    createdAt: server.createdAt.toISOString(),
    updatedAt: server.updatedAt.toISOString(),
  };
}
