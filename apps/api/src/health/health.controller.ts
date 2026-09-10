import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { SkipLicense } from '../common/decorators/skip-license.decorator';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { RedisService } from '../redis/redis.service';

@Controller()
export class HealthController {
  constructor(
    @InjectConnection() private readonly mongo: Connection,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @SkipLicense()
  @SkipThrottle()
  @Get('health')
  async health() {
    const mongoOk = this.mongo.readyState === 1;
    const redisOk = await this.redis.ping();
    return {
      status: mongoOk && redisOk ? 'ok' : 'degraded',
      mongo: mongoOk ? 'up' : 'down',
      redis: redisOk ? 'up' : 'down',
    };
  }
}
