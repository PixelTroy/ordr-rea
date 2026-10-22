import { Controller, Get, Inject } from '@nestjs/common'
import { Public } from '../auth/public.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'

@Controller('v1/health')
export class HealthController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`
    const redis = await this.redis.ping()
    return { ok: true, redis }
  }
}
