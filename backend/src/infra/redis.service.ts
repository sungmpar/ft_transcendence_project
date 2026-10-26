import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/** Shared ephemeral state for independent Vercel Function instances. */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly redis?: Redis;

  constructor() {
    const url = process.env.REDIS_URL;
    if (!url) {
      if (process.env.VERCEL) {
        throw new Error('REDIS_URL is required for multi-instance Vercel operation');
      }
      return;
    }
    this.redis = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: (attempt) => Math.min(1000, attempt * 100),
    });
    this.redis.on('error', () => undefined);
  }

  get client(): Redis | undefined {
    return this.redis;
  }

  get enabled(): boolean {
    return Boolean(this.redis);
  }

  async connect(): Promise<void> {
    if (this.redis && this.redis.status === 'wait') await this.redis.connect();
  }

  async onModuleDestroy(): Promise<void> {
    this.redis?.disconnect();
  }
}

@Global()
@Module({ providers: [RedisService], exports: [RedisService] })
export class RedisModule {}
