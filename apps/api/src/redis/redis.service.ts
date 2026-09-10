import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisCacheClient } from './redis.types';

class MemoryRedis implements RedisCacheClient {
  status = 'ready';
  private readonly store = new Map<string, { value: string; expiresAt?: number }>();

  private purge(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt && entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }

  async connect(): Promise<void> {
    this.status = 'ready';
  }

  async quit(): Promise<'OK'> {
    this.status = 'end';
    this.store.clear();
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    this.purge();
    return this.store.get(key)?.value ?? null;
  }

  async set(key: string, value: string, expiryMode?: 'EX' | 'PX', time?: number): Promise<'OK'> {
    this.purge();
    let expiresAt: number | undefined;
    if (expiryMode === 'EX') {
      expiresAt = Date.now() + Number(time) * 1000;
    } else if (expiryMode === 'PX') {
      expiresAt = Date.now() + Number(time);
    }
    this.store.set(key, { value, expiresAt });
    return 'OK';
  }

  async setNx(key: string, value: string, pxMs: number): Promise<boolean> {
    this.purge();
    if (this.store.has(key)) {
      return false;
    }
    this.store.set(key, { value, expiresAt: Date.now() + pxMs });
    return true;
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys.flat()) {
      if (this.store.delete(key)) {
        removed += 1;
      }
    }
    return removed;
  }

  async incr(key: string): Promise<number> {
    this.purge();
    const current = Number(this.store.get(key)?.value ?? '0') + 1;
    const previous = this.store.get(key);
    this.store.set(key, { value: String(current), expiresAt: previous?.expiresAt });
    return current;
  }

  async pexpire(key: string, ms: number): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) {
      return 0;
    }
    entry.expiresAt = Date.now() + ms;
    return 1;
  }

  async pttl(key: string): Promise<number> {
    this.purge();
    const entry = this.store.get(key);
    if (!entry) {
      return -2;
    }
    if (!entry.expiresAt) {
      return -1;
    }
    return Math.max(entry.expiresAt - Date.now(), 0);
  }
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: RedisCacheClient;
  readonly isMemory: boolean;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('REDIS_HOST') ?? '127.0.0.1';
    this.isMemory = this.config.get('NODE_ENV') === 'test' || host === 'memory';
    if (this.isMemory) {
      this.client = new MemoryRedis();
      return;
    }

    const password = this.config.get<string>('REDIS_PASSWORD') || undefined;
    this.client = new Redis({
      host,
      port: this.config.getOrThrow<number>('REDIS_PORT'),
      password,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
    }) as unknown as RedisCacheClient;
  }

  async connect(): Promise<void> {
    if (this.isMemory) {
      return;
    }
    const redis = this.client as unknown as Redis;
    if (redis.status === 'wait' || redis.status === 'end') {
      await redis.connect();
    }
    this.logger.log('Connected to Redis');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status !== 'end') {
      await this.client.quit();
    }
  }

  async setNx(key: string, value: string, pxMs: number): Promise<boolean> {
    if (this.isMemory) {
      return (this.client as MemoryRedis).setNx(key, value, pxMs);
    }
    const redis = this.client as unknown as Redis;
    const result = await redis.set(key, value, 'PX', pxMs, 'NX');
    return result === 'OK';
  }

  async ping(): Promise<boolean> {
    if (this.isMemory) {
      return true;
    }
    const token = `health:ping:${Date.now()}`;
    try {
      await this.client.set(token, '1', 'PX', 3000);
      const value = await this.client.get(token);
      await this.client.del(token);
      return value === '1';
    } catch {
      return false;
    }
  }
}
