import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { AuthGuard } from './auth/auth.guard'
import { AuthModule } from './auth/auth.module'
import { HealthController } from './common/health.controller'
import { PrismaModule } from './prisma/prisma.module'
import { RedisModule } from './redis/redis.module'
import { WorkspacesModule } from './workspaces/workspaces.module'

@Module({
  imports: [PrismaModule, RedisModule, AuthModule, WorkspacesModule],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
