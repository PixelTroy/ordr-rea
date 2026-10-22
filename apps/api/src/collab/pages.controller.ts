import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common'
import { User } from '@prisma/client'
import { CurrentUser } from '../auth/current-user.decorator'
import { NotificationsService } from './notifications.service'
import { PagesService } from './pages.service'
import { AccessService } from '../access/access.service'

@Controller('v1/workspaces/:slug')
export class PagesController {
  constructor(
    @Inject(PagesService) private readonly pages: PagesService,
    @Inject(NotificationsService) private readonly notes: NotificationsService,
    @Inject(AccessService) private readonly access: AccessService,
  ) {}

  @Post('pages')
  create(@CurrentUser() user: User, @Param('slug') slug: string, @Body() body: unknown) {
    return this.pages.create(user, slug, body)
  }

  @Get('pages')
  list(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.pages.list(user, slug, query)
  }

  @Get('pages/:pageId')
  get(@CurrentUser() user: User, @Param('slug') slug: string, @Param('pageId') pageId: string) {
    return this.pages.get(user, slug, pageId)
  }

  @Patch('pages/:pageId')
  update(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('pageId') pageId: string,
    @Body() body: unknown,
  ) {
    return this.pages.update(user, slug, pageId, body)
  }

  @Delete('pages/:pageId')
  remove(@CurrentUser() user: User, @Param('slug') slug: string, @Param('pageId') pageId: string) {
    return this.pages.remove(user, slug, pageId)
  }

  @Post('pages/:pageId/favorite')
  favorite(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('pageId') pageId: string,
    @Body() body: { favorite?: boolean },
  ) {
    return this.pages.favorite(user, slug, pageId, body.favorite !== false)
  }

  @Get('projects/:projectId/issues/:issueId/comments')
  comments(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
  ) {
    return this.pages.listComments(user, slug, projectId, issueId)
  }

  @Post('projects/:projectId/issues/:issueId/comments')
  addComment(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Body() body: unknown,
  ) {
    return this.pages.addComment(user, slug, projectId, issueId, body)
  }

  @Post('comments/:commentId/reactions')
  react(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('commentId') commentId: string,
    @Body() body: { emoji?: string },
  ) {
    return this.pages.react(user, slug, commentId, body.emoji || '👍')
  }

  @Get('notifications')
  async notifications(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Query('mentions') mentions?: string,
  ) {
    const { workspace } = await this.access.workspace(slug, user.id)
    return this.notes.list(user.id, workspace.id, mentions === '1')
  }

  @Post('notifications/read')
  async read(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Body() body: { ids?: string[]; all?: boolean },
  ) {
    const { workspace } = await this.access.workspace(slug, user.id)
    if (body.all) return this.notes.markAll(user.id, workspace.id)
    return this.notes.markRead(user.id, body.ids ?? [])
  }
}
