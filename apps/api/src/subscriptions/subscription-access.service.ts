import { ForbiddenException, Inject, Injectable, forwardRef } from '@nestjs/common';
import {
  ErrorCode,
  PlanFeature,
  qualityAllowed,
  SubscriptionEntitlement,
  UserRole,
  VideoQuality,
  emptyEntitlement,
  hasMinimumRole,
} from '@movie-server/shared';
import { PlansService } from './plans.service';
import { SubscriptionsService } from './subscriptions.service';
import { toEntitlement } from './subscription.mapper';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import { entitlementCacheKey } from '../common/cache-keys';
import { staffEntitlement } from './staff-entitlement';
import { vipEntitlement } from './vip-entitlement';
import { DevicesService } from '../devices/devices.service';
import { PlaybackSessionStore } from '../stream/playback-session.store';

@Injectable()
export class SubscriptionAccessService {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly plans: PlansService,
    private readonly users: UsersService,
    private readonly redis: RedisService,
    @Inject(forwardRef(() => DevicesService)) private readonly devices: DevicesService,
    @Inject(forwardRef(() => PlaybackSessionStore)) private readonly sessions: PlaybackSessionStore,
  ) {}

  async getEntitlement(userId: string): Promise<SubscriptionEntitlement> {
    const cached = await this.redis.client.get(entitlementCacheKey(userId));
    if (cached) {
      try {
        return JSON.parse(cached) as SubscriptionEntitlement;
      } catch {
        await this.redis.client.del(entitlementCacheKey(userId));
      }
    }
    const sub = await this.subscriptions.getCurrentForUser(userId);
    if (sub) {
      const plan = await this.plans.findById(String(sub.planId));
      const entitlement = toEntitlement(sub, plan);
      if (entitlement.entitled) {
        await this.redis.client.set(entitlementCacheKey(userId), JSON.stringify(entitlement), 'EX', 15);
        return entitlement;
      }
    }
    const account = await this.users.findById(userId);
    if (account?.role === UserRole.Vip) {
      const complimentary = vipEntitlement();
      await this.redis.client.set(entitlementCacheKey(userId), JSON.stringify(complimentary), 'EX', 15);
      return complimentary;
    }
    if (await this.isStaff(userId)) {
      const complimentary = staffEntitlement();
      await this.redis.client.set(entitlementCacheKey(userId), JSON.stringify(complimentary), 'EX', 15);
      return complimentary;
    }
    const empty = emptyEntitlement();
    await this.redis.client.set(entitlementCacheKey(userId), JSON.stringify(empty), 'EX', 15);
    return empty;
  }

  private async isStaff(userId: string): Promise<boolean> {
    const user = await this.users.findById(userId);
    return Boolean(user && hasMinimumRole(user.role, UserRole.Admin));
  }

  async assertEntitled(userId: string): Promise<SubscriptionEntitlement> {
    const entitlement = await this.getEntitlement(userId);
    if (!entitlement.entitled) {
      throw new ForbiddenException({
        error: entitlement.status
          ? ErrorCode.SubscriptionInactive
          : ErrorCode.SubscriptionRequired,
        message: entitlement.status
          ? 'Your subscription is not active.'
          : 'An active subscription is required.',
      });
    }
    return entitlement;
  }

  async assertFeature(userId: string, feature: PlanFeature): Promise<SubscriptionEntitlement> {
    const entitlement = await this.assertEntitled(userId);
    if (!entitlement.features.includes(feature)) {
      throw new ForbiddenException({
        error: ErrorCode.FeatureNotAllowed,
        message: `Your plan does not include ${feature}.`,
      });
    }
    return entitlement;
  }

  async assertQuality(userId: string, quality: VideoQuality): Promise<SubscriptionEntitlement> {
    const entitlement = await this.assertEntitled(userId);
    if (!entitlement.maxVideoQuality || !qualityAllowed(entitlement.maxVideoQuality, quality)) {
      throw new ForbiddenException({
        error: ErrorCode.QualityNotAllowed,
        message: `Your plan allows up to ${entitlement.maxVideoQuality ?? 'sd'} playback.`,
      });
    }
    return entitlement;
  }

  async assertPlayback(
    userId: string,
    input: { quality: VideoQuality; currentStreamCount?: number; registeredDeviceCount?: number },
  ) {
    const entitlement = await this.assertQuality(userId, input.quality);
    const [deviceCount, streamCount] = await Promise.all([
      this.devices.countingDevices(userId),
      this.sessions.listActive(userId).then((rows) => rows.length),
    ]);
    const streams = input.currentStreamCount ?? streamCount;
    const devices = input.registeredDeviceCount ?? deviceCount;
    if (streams >= entitlement.maxStreams) {
      throw new ForbiddenException({
        error: ErrorCode.StreamLimitReached,
        message: `This plan allows ${entitlement.maxStreams} simultaneous stream(s).`,
      });
    }
    if (devices >= entitlement.maxDevices) {
      throw new ForbiddenException({
        error: ErrorCode.DeviceLimitReached,
        message: `This plan allows ${entitlement.maxDevices} registered device(s).`,
      });
    }
    return entitlement;
  }
}
