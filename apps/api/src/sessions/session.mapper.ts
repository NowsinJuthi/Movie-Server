import { DeviceType, type PublicAuthSession } from '@movie-server/shared';
import { SessionDocument } from './schemas/session.schema';

export function toPublicSession(session: SessionDocument, currentSessionId?: string): PublicAuthSession {
  const type = session.deviceType as DeviceType | '';
  return {
    id: String(session._id),
    deviceId: session.deviceId ? String(session.deviceId) : null,
    deviceName: session.clientName || null,
    deviceType: type && Object.values(DeviceType).includes(type as DeviceType) ? (type as DeviceType) : null,
    browser: session.browser || null,
    userAgent: session.userAgent,
    ip: session.ip,
    current: currentSessionId === String(session._id),
    lastActiveAt: (session.lastActiveAt ?? session.createdAt).toISOString(),
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    suspicious: session.suspicious,
    flags: session.flags ?? [],
  };
}
