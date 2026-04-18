import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient } from 'redis';

@Injectable()
export class CacheService implements OnModuleInit {
  private client: ReturnType<typeof createClient> | null = null;
  private upstashUrl: string | null = null;
  private upstashToken: string | null = null;
  private enabled: boolean;

  constructor() {
    this.enabled =
      process.env.REDIS_CACHE === 'true' ||
      !!process.env.UPSTASH_REDIS_REST_URL;
  }

  async onModuleInit() {
    if (this.enabled) {
      await this.initializeClient();
    }
  }

  private async initializeClient() {
    try {
      const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
      const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
      const redisUrl = process.env.REDIS_URL;

      if (upstashUrl && upstashToken) {
        this.upstashUrl = upstashUrl;
        this.upstashToken = upstashToken;
        console.log('✓ Redis cache connected (Upstash REST)');
        return;
      }

      if (redisUrl) {
        this.client = createClient({
          url: redisUrl,
        });

        this.client.on('error', (err) => {
          console.warn('Redis cache error:', err.message);
          this.enabled = false;
        });

        await this.client.connect();
        console.log('✓ Redis cache connected (Redis client)');
        return;
      }

      console.warn(
        'No Redis configuration found (set UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN or REDIS_URL)',
      );
      this.enabled = false;
    } catch (err) {
      console.warn('Redis cache unavailable:', err?.message);
      this.enabled = false;
    }
  }

  private async upstashCommand<T = unknown>(
    command: unknown[],
  ): Promise<T | null> {
    if (!this.upstashUrl || !this.upstashToken) return null;

    const response = await fetch(this.upstashUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.upstashToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upstash cache ${response.status}: ${errorText}`);
    }

    const payload = (await response.json()) as { result?: T };
    return (payload?.result ?? null) as T | null;
  }

  async get(key: string): Promise<string | null> {
    if (!this.enabled) return null;
    try {
      if (this.upstashUrl && this.upstashToken) {
        const result = await this.upstashCommand<string>(['GET', key]);
        return result ?? null;
      }

      if (!this.client) return null;
      return await this.client.get(key);
    } catch (err) {
      console.warn('Cache get error:', err?.message);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.enabled) return;
    try {
      if (this.upstashUrl && this.upstashToken) {
        const command = ttlSeconds
          ? ['SET', key, value, 'EX', ttlSeconds]
          : ['SET', key, value];
        await this.upstashCommand(command);
        return;
      }

      if (!this.client) return;
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (err) {
      console.warn('Cache set error:', err?.message);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.enabled) return;
    try {
      if (this.upstashUrl && this.upstashToken) {
        await this.upstashCommand(['DEL', key]);
        return;
      }

      if (!this.client) return;
      await this.client.del(key);
    } catch (err) {
      console.warn('Cache delete error:', err?.message);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      if (this.upstashUrl && this.upstashToken) {
        const result = await this.upstashCommand<number>(['EXISTS', key]);
        return result === 1;
      }

      if (!this.client) return false;
      const result = await this.client.exists(key);
      return result === 1;
    } catch (err) {
      console.warn('Cache exists error:', err?.message);
      return false;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.disconnect();
    }
  }
}
