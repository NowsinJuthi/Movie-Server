import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'crypto';
import { ErrorCode } from '@movie-server/shared';
import { RedisService } from '../redis/redis.service';
import { DevicesService } from '../devices/devices.service';
import { PlaybackRecord, PlaybackRecordDocument } from './schemas/playback-record.schema';
import {
  STREAM_DEVICE_PREFIX,
  STREAM_PREFIX,
  STREAM_USER_PREFIX,
  StoredPlaybackSession,
} from './playback-session.types';

type DeviceMap = Record<string, { lastSeen: number; label: string }>;

@Injectable()
export class PlaybackSessionStore {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => DevicesService)) private readonly devices: DevicesService,
    @InjectModel(PlaybackRecord.name) private readonly records: Model<PlaybackRecordDocument>,
  ) {}

  ttlMs(): number {
    return this.config.get<number>('STREAM_SESSION_TTL_MS') ?? 90_000;
  }

  async get(sessionId: string): Promise<StoredPlaybackSession | null> {
    const raw = await this.redis.client.get(this.sessionKey(sessionId));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as StoredPlaybackSession;
  }

  async requireOwned(sessionId: string, userId: string): Promise<StoredPlaybackSession> {
    const session = await this.get(sessionId);
    if (!session || Date.now() - session.lastHeartbeat > this.ttlMs()) {
      throw new UnauthorizedException({
        error: ErrorCode.PlaybackSessionExpired,
        message: 'Playback session expired. Start playback again.',
      });
    }
    if (session.userId !== userId) {
      throw new ForbiddenException({
        error: ErrorCode.Forbidden,
        message: 'This stream belongs to another account.',
      });
    }
    return session;
  }

  async create(
    input: Omit<StoredPlaybackSession, 'id' | 'createdAt' | 'lastHeartbeat' | 'mediaToken'>,
  ): Promise<StoredPlaybackSession> {
    const now = Date.now();
    const session: StoredPlaybackSession = {
      ...input,
      id: randomBytes(16).toString('hex'),
      mediaToken: randomBytes(16).toString('hex'),
      createdAt: now,
      lastHeartbeat: now,
    };
    await this.persist(session);
    const ids = await this.activeIds(input.userId);
    const next = ids.filter((id) => id !== session.id);
    next.push(session.id);
    await this.redis.client.set(this.userKey(input.userId), JSON.stringify(next), 'PX', this.ttlMs() * 4);
    return session;
  }

  async persist(session: StoredPlaybackSession): Promise<void> {
    await this.redis.client.set(this.sessionKey(session.id), JSON.stringify(session), 'PX', this.ttlMs());
    await this.upsertRecord(session);
  }

  async heartbeat(sessionId: string, userId: string): Promise<StoredPlaybackSession> {
    const session = await this.requireOwned(sessionId, userId);
    session.lastHeartbeat = Date.now();
    await this.persist(session);
    await this.touchDevice(userId, session.deviceId, session.deviceLabel || 'AmarPin');
    await this.devices.touch(userId, session.deviceId);
    return session;
  }

  async stop(sessionId: string, userId: string): Promise<void> {
    const session = await this.get(sessionId);
    if (session && session.userId !== userId) {
      throw new ForbiddenException({
        error: ErrorCode.Forbidden,
        message: 'This stream belongs to another account.',
      });
    }
    await this.redis.client.del(this.sessionKey(sessionId));
    if (session) {
      const ids = (await this.activeIds(userId)).filter((id) => id !== sessionId);
      await this.redis.client.set(this.userKey(userId), JSON.stringify(ids), 'PX', this.ttlMs() * 4);
      await this.records.updateOne(
        { redisSessionId: sessionId },
        { $set: { endedAt: new Date(), endReason: 'stopped' } },
      );
    }
  }

  async stopForDevice(userId: string, deviceKey: string): Promise<void> {
    const active = await this.listActive(userId);
    for (const session of active.filter((item) => item.deviceId === deviceKey)) {
      await this.stop(session.id, userId);
    }
    await this.forgetDevice(userId, deviceKey);
  }

  async stopAllForUser(userId: string): Promise<void> {
    const active = await this.listActive(userId);
    for (const session of active) {
      await this.stop(session.id, userId);
    }
  }

  async listAllLive(): Promise<StoredPlaybackSession[]> {
    const ttl = this.ttlMs();
    const rows = await this.records
      .find({ endedAt: null, lastHeartbeatAt: { $gte: new Date(Date.now() - ttl * 2) } })
      .sort({ lastHeartbeatAt: -1 })
      .limit(200)
      .exec();
    const live: StoredPlaybackSession[] = [];
    const sessions = await Promise.all(rows.map((row) => this.get(row.redisSessionId)));
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const session = sessions[index];
      if (session && Date.now() - session.lastHeartbeat <= ttl) {
        live.push(session);
      } else {
        row.endedAt = new Date();
        row.endReason = 'expired';
        await row.save();
      }
    }
    return live;
  }

  async listActive(userId: string): Promise<StoredPlaybackSession[]> {
    const ids = await this.activeIds(userId);
    const sessions: StoredPlaybackSession[] = [];
    const live: string[] = [];
    for (const id of ids) {
      const session = await this.get(id);
      if (session && Date.now() - session.lastHeartbeat <= this.ttlMs()) {
        sessions.push(session);
        live.push(id);
      } else {
        await this.redis.client.del(this.sessionKey(id));
      }
    }
    await this.redis.client.set(this.userKey(userId), JSON.stringify(live), 'PX', this.ttlMs() * 4);
    return sessions;
  }

  async runExclusive<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    const lockKey = `stream:lock:${userId}`;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const locked = await this.redis.setNx(lockKey, '1', 4000);
      if (locked) {
        try {
          return await fn();
        } finally {
          await this.redis.client.del(lockKey);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new HttpException(
      {
        error: ErrorCode.TooManyRequests,
        message: 'Playback is busy. Try again.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  async assertStreamSlot(
    userId: string,
    maxStreams: number,
    match: { deviceId: string; mediaId: string },
  ): Promise<StoredPlaybackSession | null> {
    const active = await this.listActive(userId);
    const existing = active.find((item) => item.deviceId === match.deviceId && item.mediaId === match.mediaId);
    if (existing) {
      return existing;
    }
    if (active.length >= maxStreams) {
      throw new ForbiddenException({
        error: ErrorCode.StreamLimitReached,
        message: `This plan allows ${maxStreams} simultaneous stream(s).`,
      });
    }
    return null;
  }

  async stopForMediaIds(mediaIds: string[]): Promise<void> {
    const unique = [...new Set(mediaIds.filter(Boolean))];
    if (unique.length === 0) {
      return;
    }
    const rows = await this.records
      .find({ mediaId: { $in: unique }, endedAt: null })
      .limit(2000)
      .exec();
    for (const row of rows) {
      const session = await this.get(row.redisSessionId);
      if (session) {
        await this.stop(session.id, session.userId);
      } else {
        row.endedAt = new Date();
        row.endReason = 'revoked';
        await row.save();
      }
    }
  }

  async registerDevice(userId: string, deviceId: string, label: string, maxDevices: number): Promise<void> {
    const devices = await this.devicesMap(userId);
    const now = Date.now();
    const windowMs = 30 * 24 * 60 * 60 * 1000;
    for (const [id, meta] of Object.entries(devices)) {
      if (now - meta.lastSeen > windowMs) {
        delete devices[id];
      }
    }
    const known = Boolean(devices[deviceId]);
    if (!known && Object.keys(devices).length >= maxDevices) {
      throw new ForbiddenException({
        error: ErrorCode.DeviceLimitReached,
        message: `This plan allows ${maxDevices} registered device(s).`,
      });
    }
    devices[deviceId] = { lastSeen: now, label: label.slice(0, 80) || 'AmarPin' };
    await this.redis.client.set(this.deviceKey(userId), JSON.stringify(devices), 'PX', windowMs);
    await this.devices.registerForPlayback(userId, deviceId, label, maxDevices, undefined, { skipLimit: true });
  }

  private async touchDevice(userId: string, deviceId: string, label: string): Promise<void> {
    const devices = await this.devicesMap(userId);
    devices[deviceId] = { lastSeen: Date.now(), label };
    await this.redis.client.set(
      this.deviceKey(userId),
      JSON.stringify(devices),
      'PX',
      30 * 24 * 60 * 60 * 1000,
    );
  }

  private async forgetDevice(userId: string, deviceId: string): Promise<void> {
    const devices = await this.devicesMap(userId);
    delete devices[deviceId];
    await this.redis.client.set(this.deviceKey(userId), JSON.stringify(devices), 'PX', 30 * 24 * 60 * 60 * 1000);
  }

  private async upsertRecord(session: StoredPlaybackSession): Promise<void> {
    const now = new Date(session.lastHeartbeat);
    await this.records.findOneAndUpdate(
      { redisSessionId: session.id },
      {
        $set: {
          lastHeartbeatAt: now,
          quality: session.quality,
          deviceKey: session.deviceId,
          endedAt: null,
          endReason: null,
        },
        $setOnInsert: {
          redisSessionId: session.id,
          userId: new Types.ObjectId(session.userId),
          profileId: new Types.ObjectId(session.profileId),
          mediaType: session.mediaType,
          mediaId: session.mediaId,
          ip: '',
          userAgent: session.deviceLabel ?? '',
          startedAt: new Date(session.createdAt),
        },
      },
      { upsert: true },
    );
  }

  private async devicesMap(userId: string): Promise<DeviceMap> {
    const raw = await this.redis.client.get(this.deviceKey(userId));
    return raw ? (JSON.parse(raw) as DeviceMap) : {};
  }

  private async activeIds(userId: string): Promise<string[]> {
    const raw = await this.redis.client.get(this.userKey(userId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  }

  private sessionKey(id: string): string {
    return `${STREAM_PREFIX}${id}`;
  }

  private userKey(userId: string): string {
    return `${STREAM_USER_PREFIX}${userId}`;
  }

  private deviceKey(userId: string): string {
    return `${STREAM_DEVICE_PREFIX}${userId}`;
  }
}
