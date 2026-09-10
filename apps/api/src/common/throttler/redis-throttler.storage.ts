import { Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redisService: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName: string,
  ) {
    const redis = this.redisService.client;
    const hitsKey = `throttle:${key}`;
    const blockKey = `throttle:block:${key}`;

    const blockedTtl = await redis.pttl(blockKey);
    if (blockedTtl > 0) {
      return {
        totalHits: limit + 1,
        timeToExpire: ttl,
        isBlocked: true,
        timeToBlockExpire: blockedTtl,
      };
    }

    const totalHits = await redis.incr(hitsKey);
    if (totalHits === 1) {
      await redis.pexpire(hitsKey, ttl);
    }
    const timeToExpire = Math.max(await redis.pttl(hitsKey), 0);
    const isBlocked = totalHits > limit;

    if (isBlocked && blockDuration > 0) {
      await redis.set(blockKey, '1', 'PX', blockDuration);
      return {
        totalHits,
        timeToExpire,
        isBlocked: true,
        timeToBlockExpire: blockDuration,
      };
    }

    return {
      totalHits,
      timeToExpire,
      isBlocked,
      timeToBlockExpire: 0,
    };
  }
}
