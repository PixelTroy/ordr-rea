import { Module } from '@nestjs/common'
import { NotificationsService } from './notifications.service'
import { PagesController } from './pages.controller'
import { PagesGateway } from './pages.gateway'
import { PagesService } from './pages.service'

@Module({
  controllers: [PagesController],
  providers: [PagesService, PagesGateway, NotificationsService],
  exports: [NotificationsService],
})
export class CollabModule {}
