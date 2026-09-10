import { Global, Module, OnModuleInit } from '@nestjs/common';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule implements OnModuleInit {
  constructor(private readonly redisService: RedisService) {}

  async onModuleInit(): Promise<void> {
    await this.redisService.connect();
  }
}
