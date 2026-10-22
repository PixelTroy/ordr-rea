import { Module } from '@nestjs/common'
import { PlatformModule } from '../platform/platform.module'
import { PlanningController } from './planning.controller'
import { PlanningService } from './planning.service'

@Module({
  imports: [PlatformModule],
  controllers: [PlanningController],
  providers: [PlanningService],
})
export class PlanningModule {}
