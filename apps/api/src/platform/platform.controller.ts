import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common'
import { User } from '@prisma/client'
import { CurrentUser } from '../auth/current-user.decorator'
import { PlatformService } from './platform.service'

@Controller('v1/workspaces/:slug')
export class PlatformController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get('search')
  search(@CurrentUser() user: User, @Param('slug') slug: string, @Query('q') q = '') {
    return this.platform.search(user, slug, q)
  }

  @Get('export')
  exportWorkspace(@CurrentUser() user: User, @Param('slug') slug: string) {
    return this.platform.exportWorkspace(user, slug)
  }

  @Post('import')
  importWorkspace(@CurrentUser() user: User, @Param('slug') slug: string, @Body() body: unknown) {
    return this.platform.importWorkspace(user, slug, body)
  }

  @Get('access-tokens')
  listTokens(@CurrentUser() user: User, @Param('slug') slug: string) {
    return this.platform.listTokens(user, slug)
  }

  @Post('access-tokens')
  createToken(@CurrentUser() user: User, @Param('slug') slug: string, @Body() body: unknown) {
    return this.platform.createToken(user, slug, body)
  }

  @Delete('access-tokens/:tokenId')
  removeToken(@CurrentUser() user: User, @Param('slug') slug: string, @Param('tokenId') tokenId: string) {
    return this.platform.removeToken(user, slug, tokenId)
  }

  @Get('webhooks')
  listWebhooks(@CurrentUser() user: User, @Param('slug') slug: string) {
    return this.platform.listWebhooks(user, slug)
  }

  @Post('webhooks')
  createWebhook(@CurrentUser() user: User, @Param('slug') slug: string, @Body() body: unknown) {
    return this.platform.createWebhook(user, slug, body)
  }

  @Get('webhooks/:webhookId')
  getWebhook(@CurrentUser() user: User, @Param('slug') slug: string, @Param('webhookId') webhookId: string) {
    return this.platform.getWebhook(user, slug, webhookId)
  }

  @Delete('webhooks/:webhookId')
  removeWebhook(@CurrentUser() user: User, @Param('slug') slug: string, @Param('webhookId') webhookId: string) {
    return this.platform.removeWebhook(user, slug, webhookId)
  }

  @Get('projects/:projectId/views')
  listViews(@CurrentUser() user: User, @Param('slug') slug: string, @Param('projectId') projectId: string) {
    return this.platform.listViews(user, slug, projectId)
  }

  @Post('projects/:projectId/views')
  createView(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Body() body: unknown,
  ) {
    return this.platform.createView(user, slug, projectId, body)
  }

  @Get('projects/:projectId/views/:viewId')
  getView(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('viewId') viewId: string,
  ) {
    return this.platform.getView(user, slug, projectId, viewId)
  }

  @Patch('projects/:projectId/views/:viewId')
  updateView(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('viewId') viewId: string,
    @Body() body: unknown,
  ) {
    return this.platform.updateView(user, slug, projectId, viewId, body)
  }

  @Delete('projects/:projectId/views/:viewId')
  removeView(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('viewId') viewId: string,
  ) {
    return this.platform.removeView(user, slug, projectId, viewId)
  }

  @Post('projects/:projectId/views/:viewId/favorite')
  favorite(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('viewId') viewId: string,
  ) {
    return this.platform.toggleFavorite(user, slug, projectId, viewId)
  }
}
