import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { AccessModule } from './access/access.module'
import { AuthGuard } from './auth/auth.guard'
import { AuthModule } from './auth/auth.module'
import { HealthController } from './common/health.controller'
import { IssuesModule } from './issues/issues.module'
import { PlanningModule } from './planning/planning.module'
import { PrismaModule } from './prisma/prisma.module'
import { ProjectsModule } from './projects/projects.module'
import { RedisModule } from './redis/redis.module'
import { WorkspacesModule } from './workspaces/workspaces.module'

@Module({
  imports: [PrismaModule, RedisModule, AccessModule, AuthModule, WorkspacesModule, ProjectsModule, IssuesModule, PlanningModule],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
