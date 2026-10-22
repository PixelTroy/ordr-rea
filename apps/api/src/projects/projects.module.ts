import { Module } from '@nestjs/common'
import { PlatformModule } from '../platform/platform.module'
import { ProjectsController } from './projects.controller'
import { ProjectsService } from './projects.service'

@Module({
  imports: [PlatformModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
