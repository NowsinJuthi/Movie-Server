import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SuspiciousReason } from '@movie-server/shared';
import { generateOpaqueToken, hashToken } from '../common/security/tokens';
import { RedisService } from '../redis/redis.service';
import { Session, SessionDocument } from './schemas/session.schema';

@Injectable()
export class SessionsService {
  constructor(
    @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>,
    private readonly redis: RedisService,
  ) {}

  async create(input: {
    userId: string;
    userAgent?: string;
    ip?: string;
    expiresAt: Date;
    deviceId?: string | null;
    deviceKey?: string;
    clientName?: string;
    deviceType?: string;
    browser?: string;
    suspicious?: boolean;
    flags?: string[];
  }): Promise<{ session: SessionDocument; refreshToken: string }> {
    const refreshToken = generateOpaqueToken(48);
    const tokenHash = hashToken(refreshToken);
    const now = new Date();
    const session = await this.sessionModel.create({
      userId: new Types.ObjectId(input.userId),
      tokenHash,
      userAgent: input.userAgent ?? '',
      ip: input.ip ?? '',
      deviceId: input.deviceId ? new Types.ObjectId(input.deviceId) : null,
      deviceKey: input.deviceKey ?? '',
      clientName: input.clientName ?? '',
      deviceType: input.deviceType ?? '',
      browser: input.browser ?? '',
      lastActiveAt: now,
      suspicious: input.suspicious ?? false,
      flags: input.flags ?? [],
      expiresAt: input.expiresAt,
    });
    await this.markActive(session);
    return { session, refreshToken };
  }

  async findActiveByRefreshToken(refreshToken: string): Promise<SessionDocument | null> {
    const tokenHash = hashToken(refreshToken);
    return this.sessionModel
      .findOne({
        tokenHash,
        revoked: false,
        expiresAt: { $gt: new Date() },
      })
      .exec();
  }

  async findReusedRefreshToken(refreshToken: string): Promise<SessionDocument | null> {
    const previousSessionId = await this.redis.client.get(
      `auth:refresh-prev:${hashToken(refreshToken)}`,
    );
    if (!previousSessionId) {
      return null;
    }
    return this.sessionModel.findById(previousSessionId).exec();
  }

  /** Short-lived copy of the rotated refresh token so concurrent refreshes can succeed safely. */
  async findRefreshGrace(
    refreshToken: string,
  ): Promise<{ sessionId: string; refreshToken: string } | null> {
    const raw = await this.redis.client.get(`auth:refresh-grace:${hashToken(refreshToken)}`);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as { sessionId?: string; refreshToken?: string };
      if (!parsed.sessionId || !parsed.refreshToken) {
        return null;
      }
      return { sessionId: parsed.sessionId, refreshToken: parsed.refreshToken };
    } catch {
      return null;
    }
  }

  async rotate(
    session: SessionDocument,
    expiresAt: Date,
  ): Promise<{ session: SessionDocument; refreshToken: string }> {
    const previousHash = session.tokenHash;
    const refreshToken = generateOpaqueToken(48);
    const tokenHash = hashToken(refreshToken);
    const ttlMs = Math.max(expiresAt.getTime() - Date.now(), 60_000);

    await this.redis.client.set(
      `auth:refresh-prev:${previousHash}`,
      String(session._id),
      'PX',
      ttlMs,
    );
    // Allow a brief concurrent refresh with the old cookie (React Strict Mode / multi-tab).
    await this.redis.client.set(
      `auth:refresh-grace:${previousHash}`,
      JSON.stringify({ sessionId: String(session._id), refreshToken }),
      'PX',
      15_000,
    );

    session.tokenHash = tokenHash;
    session.replacedByHash = tokenHash;
    session.expiresAt = expiresAt;
    session.lastActiveAt = new Date();
    await session.save();
    await this.markActive(session);
    return { session, refreshToken };
  }

  async revoke(session: SessionDocument): Promise<void> {
    session.revoked = true;
    session.revokedAt = new Date();
    await session.save();
    await this.redis.client.del(`auth:session:${String(session._id)}`);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const sessions = await this.sessionModel
      .find({ userId: new Types.ObjectId(userId), revoked: false })
      .select('_id')
      .exec();
    await this.sessionModel.updateMany(
      { userId: new Types.ObjectId(userId), revoked: false },
      { $set: { revoked: true, revokedAt: new Date() } },
    );
    if (sessions.length) {
      await this.redis.client.del(
        ...sessions.map((item) => `auth:session:${String(item._id)}`),
      );
    }
  }

  async findById(sessionId: string): Promise<SessionDocument | null> {
    return this.sessionModel.findById(sessionId).exec();
  }

  async setActiveProfile(sessionId: string, profileId: string | null): Promise<void> {
    await this.sessionModel.findByIdAndUpdate(sessionId, {
      $set: { activeProfileId: profileId ? new Types.ObjectId(profileId) : null },
    });
  }

  async isActive(sessionId: string): Promise<boolean> {
    const cached = await this.redis.client.get(`auth:session:${sessionId}`);
    if (cached === '1') {
      return true;
    }
    if (cached === '0') {
      return false;
    }
    const session = await this.sessionModel.findById(sessionId).exec();
    const active =
      !!session && !session.revoked && session.expiresAt.getTime() > Date.now();
    await this.redis.client.set(
      `auth:session:${sessionId}`,
      active ? '1' : '0',
      'EX',
      60,
    );
    return active;
  }

  async listActiveForUser(userId: string): Promise<SessionDocument[]> {
    return this.sessionModel
      .find({
        userId: new Types.ObjectId(userId),
        revoked: false,
        expiresAt: { $gt: new Date() },
      })
      .sort({ lastActiveAt: -1, createdAt: -1 })
      .limit(50)
      .exec();
  }

  async listRecentForAdmin(limit = 80): Promise<SessionDocument[]> {
    return this.sessionModel
      .find({
        revoked: false,
        expiresAt: { $gt: new Date() },
      })
      .sort({ lastActiveAt: -1, createdAt: -1 })
      .limit(Math.min(limit, 200))
      .exec();
  }

  async listSuspiciousForAdmin(limit = 80): Promise<SessionDocument[]> {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return this.sessionModel
      .find({
        suspicious: true,
        lastActiveAt: { $gte: since },
      })
      .sort({ lastActiveAt: -1 })
      .limit(Math.min(limit, 200))
      .exec();
  }

  async markRefreshReuse(userId: string): Promise<void> {
    await this.sessionModel.updateMany(
      { userId: new Types.ObjectId(userId), revoked: false },
      {
        $set: { suspicious: true },
        $addToSet: { flags: SuspiciousReason.RefreshReuse },
      },
    );
  }

  async hasActiveDevice(userId: string, deviceKey: string): Promise<boolean> {
    if (!deviceKey) {
      return false;
    }
    const count = await this.sessionModel.countDocuments({
      userId: new Types.ObjectId(userId),
      deviceKey,
      revoked: false,
      expiresAt: { $gt: new Date() },
    });
    return count > 0;
  }

  async revokeById(userId: string, sessionId: string): Promise<SessionDocument | null> {
    const session = await this.sessionModel.findOne({
      _id: new Types.ObjectId(sessionId),
      userId: new Types.ObjectId(userId),
    });
    if (!session || session.revoked) {
      return null;
    }
    await this.revoke(session);
    return session;
  }

  async revokeOwnedOrAdmin(sessionId: string): Promise<SessionDocument | null> {
    const session = await this.sessionModel.findById(sessionId);
    if (!session || session.revoked) {
      return null;
    }
    await this.revoke(session);
    return session;
  }

  async revokeByDevice(userId: string, deviceKey: string): Promise<number> {
    const sessions = await this.sessionModel
      .find({
        userId: new Types.ObjectId(userId),
        deviceKey,
        revoked: false,
      })
      .exec();
    for (const session of sessions) {
      await this.revoke(session);
    }
    return sessions.length;
  }

  async touch(sessionId: string, extras?: { ip?: string }): Promise<void> {
    const key = `auth:touch:${sessionId}`;
    const gated = await this.redis.client.get(key);
    if (gated) {
      return;
    }
    await this.redis.client.set(key, '1', 'PX', 60_000);
    const update: Record<string, unknown> = { lastActiveAt: new Date() };
    if (extras?.ip) {
      update.ip = extras.ip;
    }
    await this.sessionModel.findByIdAndUpdate(sessionId, { $set: update });
  }

  async activeDistinctIps(userId: string): Promise<string[]> {
    const rows = await this.sessionModel
      .find({
        userId: new Types.ObjectId(userId),
        revoked: false,
        expiresAt: { $gt: new Date() },
      })
      .select('ip')
      .lean();
    return [...new Set(rows.map((row) => row.ip).filter(Boolean))];
  }

  async previousForUser(userId: string): Promise<SessionDocument | null> {
    return this.sessionModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  private async markActive(session: SessionDocument): Promise<void> {
    const ttl = Math.max(Math.floor((session.expiresAt.getTime() - Date.now()) / 1000), 60);
    await this.redis.client.set(`auth:session:${String(session._id)}`, '1', 'EX', ttl);
  }
}
