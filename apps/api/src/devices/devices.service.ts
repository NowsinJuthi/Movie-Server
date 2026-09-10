import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  DeviceType,
  ErrorCode,
  type PublicDevice,
} from '@movie-server/shared';
import { Device, DeviceDocument } from './schemas/device.schema';
import { parseUserAgent } from './device-ua';

const DEVICE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class DevicesService {
  constructor(@InjectModel(Device.name) private readonly deviceModel: Model<DeviceDocument>) {}

  async upsertFromAuth(input: {
    userId: string;
    deviceKey?: string;
    deviceName?: string;
    userAgent?: string;
    ip?: string;
  }): Promise<{ device: DeviceDocument | null; isNew: boolean }> {
    const deviceKey = sanitizeKey(input.deviceKey);
    if (!deviceKey) {
      return { device: null, isNew: false };
    }
    const parsed = parseUserAgent(input.userAgent);
    const now = new Date();
    const existing = await this.deviceModel.findOne({
      userId: new Types.ObjectId(input.userId),
      deviceKey,
    });
    if (existing && !existing.revoked) {
      existing.lastActiveAt = now;
      existing.ip = input.ip ?? existing.ip;
      existing.userAgent = input.userAgent ?? existing.userAgent;
      if (!existing.name && input.deviceName) {
        existing.name = input.deviceName.slice(0, 80);
      }
      await existing.save();
      return { device: existing, isNew: false };
    }
    if (existing?.revoked) {
      existing.revoked = false;
      existing.revokedAt = undefined;
      existing.lastActiveAt = now;
      existing.firstSeenAt = now;
      existing.ip = input.ip ?? '';
      existing.userAgent = input.userAgent ?? '';
      existing.name = (input.deviceName ?? parsed.name).slice(0, 80);
      existing.countsTowardLimit = false;
      await existing.save();
      return { device: existing, isNew: true };
    }
    const created = await this.deviceModel.create({
      userId: new Types.ObjectId(input.userId),
      deviceKey,
      name: (input.deviceName ?? parsed.name).slice(0, 80),
      type: parsed.type,
      platform: parsed.platform,
      browser: parsed.browser,
      userAgent: input.userAgent ?? '',
      ip: input.ip ?? '',
      countsTowardLimit: false,
      firstSeenAt: now,
      lastActiveAt: now,
    });
    return { device: created, isNew: true };
  }

  async registerForPlayback(
    userId: string,
    deviceKey: string,
    label: string,
    maxDevices: number,
    extras?: { userAgent?: string; ip?: string },
    options?: { skipLimit?: boolean },
  ): Promise<DeviceDocument> {
    const key = sanitizeKey(deviceKey) || 'default';
    const parsed = parseUserAgent(extras?.userAgent ?? label);
    const now = new Date();
    await this.pruneStale(userId);
    const existing = await this.deviceModel.findOne({
      userId: new Types.ObjectId(userId),
      deviceKey: key,
      revoked: false,
    });
    if (existing) {
      existing.lastActiveAt = now;
      existing.countsTowardLimit = true;
      existing.ip = extras?.ip ?? existing.ip;
      if (label) {
        existing.name = existing.name || label.slice(0, 80);
      }
      await existing.save();
      return existing;
    }
    if (!options?.skipLimit) {
      const counted = await this.countingDevices(userId);
      if (counted >= maxDevices) {
        throw new ForbiddenException({
          error: ErrorCode.DeviceLimitReached,
          message: `This plan allows ${maxDevices} registered device(s).`,
        });
      }
    }
    return this.deviceModel.create({
      userId: new Types.ObjectId(userId),
      deviceKey: key,
      name: (label || parsed.name).slice(0, 80),
      type: parsed.type === DeviceType.Unknown ? DeviceType.Browser : parsed.type,
      platform: parsed.platform,
      browser: parsed.browser,
      userAgent: extras?.userAgent ?? label,
      ip: extras?.ip ?? '',
      countsTowardLimit: true,
      firstSeenAt: now,
      lastActiveAt: now,
    });
  }

  async list(userId: string): Promise<DeviceDocument[]> {
    await this.pruneStale(userId);
    return this.deviceModel
      .find({ userId: new Types.ObjectId(userId), revoked: false })
      .sort({ lastActiveAt: -1 })
      .exec();
  }

  async countingDevices(userId: string): Promise<number> {
    const since = new Date(Date.now() - DEVICE_WINDOW_MS);
    return this.deviceModel.countDocuments({
      userId: new Types.ObjectId(userId),
      revoked: false,
      countsTowardLimit: true,
      lastActiveAt: { $gte: since },
    });
  }

  async createdLastDay(userId: string): Promise<number> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.deviceModel.countDocuments({
      userId: new Types.ObjectId(userId),
      firstSeenAt: { $gte: since },
    });
  }

  async rename(userId: string, deviceId: string, name: string): Promise<DeviceDocument> {
    const device = await this.owned(userId, deviceId);
    device.name = name.slice(0, 80);
    await device.save();
    return device;
  }

  async revoke(userId: string, deviceId: string): Promise<DeviceDocument> {
    const device = await this.owned(userId, deviceId);
    device.revoked = true;
    device.revokedAt = new Date();
    device.countsTowardLimit = false;
    await device.save();
    return device;
  }

  async revokeByAdmin(deviceId: string): Promise<DeviceDocument | null> {
    const device = await this.deviceModel.findById(deviceId);
    if (!device || device.revoked) {
      return null;
    }
    device.revoked = true;
    device.revokedAt = new Date();
    device.countsTowardLimit = false;
    await device.save();
    return device;
  }

  async touch(userId: string, deviceKey: string, extras?: { ip?: string }): Promise<void> {
    if (!deviceKey) return;
    await this.deviceModel.updateOne(
      { userId: new Types.ObjectId(userId), deviceKey, revoked: false },
      { $set: { lastActiveAt: new Date(), ...(extras?.ip ? { ip: extras.ip } : {}) } },
    );
  }

  async markSuspicious(deviceId: string, flags: string[]): Promise<void> {
    if (!deviceId || flags.length === 0) return;
    await this.deviceModel.findByIdAndUpdate(deviceId, {
      $set: { suspicious: true },
      $addToSet: { flags: { $each: flags } },
    });
  }

  toPublic(
    device: DeviceDocument,
    extras: { currentDeviceKey?: string | null; playingKeys?: Set<string> },
  ): PublicDevice {
    return {
      id: String(device._id),
      name: device.name,
      type: device.type,
      platform: device.platform ?? null,
      browser: device.browser ?? null,
      userAgent: device.userAgent,
      ip: device.ip,
      lastActiveAt: device.lastActiveAt.toISOString(),
      firstSeenAt: device.firstSeenAt.toISOString(),
      current: Boolean(extras.currentDeviceKey && extras.currentDeviceKey === device.deviceKey),
      countsTowardLimit: device.countsTowardLimit,
      playing: Boolean(extras.playingKeys?.has(device.deviceKey)),
      suspicious: device.suspicious,
      flags: device.flags ?? [],
    };
  }

  private async owned(userId: string, deviceId: string): Promise<DeviceDocument> {
    const device = await this.deviceModel.findOne({
      _id: new Types.ObjectId(deviceId),
      userId: new Types.ObjectId(userId),
      revoked: false,
    });
    if (!device) {
      throw new NotFoundException({
        error: ErrorCode.NotFound,
        message: 'Device not found.',
      });
    }
    return device;
  }

  private async pruneStale(userId: string): Promise<void> {
    const since = new Date(Date.now() - DEVICE_WINDOW_MS);
    await this.deviceModel.updateMany(
      {
        userId: new Types.ObjectId(userId),
        revoked: false,
        countsTowardLimit: true,
        lastActiveAt: { $lt: since },
      },
      { $set: { countsTowardLimit: false } },
    );
  }
}

function sanitizeKey(value?: string): string {
  const trimmed = (value ?? '').trim().slice(0, 80);
  if (!/^[a-zA-Z0-9_-]{4,80}$/.test(trimmed)) {
    return '';
  }
  return trimmed;
}
