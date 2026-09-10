import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { AdminAuditLog, UserRole } from '@movie-server/shared';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

@Injectable()
export class AuditService {
  constructor(@InjectModel(AuditLog.name) private readonly logs: Model<AuditLogDocument>) {}

  async record(input: {
    actorUserId: string;
    actorEmail: string;
    actorRole: UserRole;
    method: string;
    path: string;
    statusCode: number;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    const { resource, resourceId, action } = parseAdminPath(input.method, input.path);
    await this.logs.create({
      actorUserId: new Types.ObjectId(input.actorUserId),
      actorEmail: input.actorEmail,
      actorRole: input.actorRole,
      method: input.method,
      path: input.path.slice(0, 240),
      action,
      resource,
      resourceId,
      statusCode: input.statusCode,
      ip: (input.ip ?? '').slice(0, 64),
      userAgent: (input.userAgent ?? '').slice(0, 512),
    });
  }

  async list(query: { q?: string; actorUserId?: string; page?: number; limit?: number }) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
    const filter: Record<string, unknown> = {};
    if (query.actorUserId && Types.ObjectId.isValid(query.actorUserId)) {
      filter.actorUserId = new Types.ObjectId(query.actorUserId);
    }
    if (query.q?.trim()) {
      const q = query.q.trim();
      filter.$or = [
        { actorEmail: new RegExp(escapeRegex(q), 'i') },
        { action: new RegExp(escapeRegex(q), 'i') },
        { path: new RegExp(escapeRegex(q), 'i') },
        { resource: new RegExp(escapeRegex(q), 'i') },
      ];
    }
    const [items, total] = await Promise.all([
      this.logs
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.logs.countDocuments(filter),
    ]);
    return {
      items: items.map(toPublicAudit),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }
}

export function parseAdminPath(method: string, rawPath: string): {
  action: string;
  resource: string | null;
  resourceId: string | null;
} {
  const path = rawPath.replace(/^\/api\/v1/, '').split('?')[0];
  const parts = path.split('/').filter(Boolean);
  const adminIdx = parts.indexOf('admin');
  const rest = adminIdx >= 0 ? parts.slice(adminIdx + 1) : parts;
  const resource = rest[0] ?? null;
  const maybeId = rest.find((part, index) => index > 0 && /^[a-f0-9]{24}$/i.test(part)) ?? null;
  const tail = rest.filter((part) => !/^[a-f0-9]{24}$/i.test(part)).slice(1).join('.');
  const action = [method.toLowerCase(), resource, tail].filter(Boolean).join('.');
  return { action, resource, resourceId: maybeId };
}

function toPublicAudit(row: AuditLogDocument): AdminAuditLog {
  return {
    id: String(row._id),
    actorUserId: String(row.actorUserId),
    actorEmail: row.actorEmail,
    actorRole: row.actorRole,
    method: row.method,
    path: row.path,
    action: row.action,
    resource: row.resource ?? null,
    resourceId: row.resourceId ?? null,
    statusCode: row.statusCode,
    ip: row.ip,
    userAgent: row.userAgent,
    createdAt: row.createdAt.toISOString(),
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
