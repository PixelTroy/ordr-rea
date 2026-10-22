import { Injectable, OnModuleDestroy } from '@nestjs/common'
import Redis from 'ioredis'

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis | null = null

  constructor() {
    const url = process.env.REDIS_URL
    if (!url) return
    this.client = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    })
    this.client.on('error', () => undefined)
    void this.client.connect().catch(() => undefined)
  }

  async hit(key: string, windowSec: number): Promise<number> {
    if (!this.client) return 0
    try {
      const count = await this.client.incr(key)
      if (count === 1) await this.client.expire(key, windowSec)
      return count
    } catch {
      return 0
    }
  }

  async ping(): Promise<boolean> {
    if (!this.client) return false
    try {
      return (await this.client.ping()) === 'PONG'
    } catch {
      return false
    }
  }

  async publish(channel: string, message: string): Promise<void> {
    if (!this.client) return
    try {
      await this.client.publish(channel, message)
    } catch {
      /* collaboration falls back to the local process */
    }
  }

  onModuleDestroy() {
    this.client?.disconnect()
  }
}
