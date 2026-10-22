import { Module } from '@nestjs/common'
import { CollabModule } from '../collab/collab.module'
import { IssuesController } from './issues.controller'
import { IssuesService } from './issues.service'

@Module({
  imports: [CollabModule],
  controllers: [IssuesController],
  providers: [IssuesService],
  exports: [IssuesService],
})
export class IssuesModule {}
