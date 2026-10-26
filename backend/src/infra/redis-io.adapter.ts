import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { ServerOptions } from 'socket.io';
import Redis from 'ioredis';
import { RedisService } from './redis.service';
import { REALTIME_PING_INTERVAL_MS, REALTIME_PING_TIMEOUT_MS } from '../../../shared/realtime-policy';

/** Share Socket.IO rooms and event delivery across Vercel Function instances. */
export class RedisIoAdapter extends IoAdapter {
  private publisher?: Redis;
  private subscriber?: Redis;
  private adapterFactory?: ReturnType<typeof createAdapter>;

  constructor(app: INestApplicationContext, private readonly redis: RedisService) {
    super(app);
  }

  async connect(): Promise<void> {
    if (!this.redis.client) return;
    await this.redis.connect();
    this.publisher = this.redis.client.duplicate();
    this.subscriber = this.redis.client.duplicate();
    try {
      await Promise.all([this.publisher.connect(), this.subscriber.connect()]);
      // A Redis database can be shared by several isolated Preview deployments.
      // Scope Socket.IO broadcasts and cross-node room operations exactly like
      // the game authority, otherwise identically named rooms leak across them.
      const namespace = (process.env.GAME_REDIS_NAMESPACE || process.env.VERCEL_URL || 'local')
        .replace(/[^a-zA-Z0-9:_-]/g, '_');
      this.adapterFactory = createAdapter(this.publisher, this.subscriber, {
        key: `ft:socket.io:${namespace}`,
        publishOnSpecificResponseChannel: true,
      });
    } catch (error) {
      this.publisher.disconnect();
      this.subscriber.disconnect();
      throw error;
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, {
      ...options,
      cors: { origin: true, credentials: true },
      // One Engine.IO server backs every namespace. A silent Function close
      // must be detected before the game's bounded reconnect grace expires.
      pingInterval: REALTIME_PING_INTERVAL_MS,
      pingTimeout: REALTIME_PING_TIMEOUT_MS,
      // Vercel WebSockets are routed directly without polling upgrades.
      ...(process.env.VERCEL ? { transports: ['websocket'] } : {}),
    });
    if (this.adapterFactory) server.adapter(this.adapterFactory);
    return server;
  }

  async close(): Promise<void> {
    this.publisher?.disconnect();
    this.subscriber?.disconnect();
  }
}
