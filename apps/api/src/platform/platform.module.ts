import { Module } from '@nestjs/common'
import { PlatformController } from './platform.controller'
import { PlatformService } from './platform.service'
import { WebhooksService } from './webhooks.service'

@Module({
  controllers: [PlatformController],
  providers: [PlatformService, WebhooksService],
  exports: [WebhooksService],
})
export class PlatformModule {}
