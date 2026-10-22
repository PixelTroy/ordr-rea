import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from '@nestjs/common'
import { User } from '@prisma/client'
import { CurrentUser } from '../auth/current-user.decorator'
import { Public } from '../auth/public.decorator'
import { WorkspacesService } from './workspaces.service'

@Controller('v1')
export class WorkspacesController {
  constructor(@Inject(WorkspacesService) private readonly workspaces: WorkspacesService) {}

  @Post('workspaces')
  create(@CurrentUser() user: User, @Body() body: unknown) {
    return this.workspaces.create(user, body)
  }

  @Get('workspaces')
  list(@CurrentUser() user: User) {
    return this.workspaces.list(user)
  }

  @Get('workspaces/:slug')
  get(@CurrentUser() user: User, @Param('slug') slug: string) {
    return this.workspaces.get(user, slug)
  }

  @Patch('workspaces/:slug')
  update(@CurrentUser() user: User, @Param('slug') slug: string, @Body() body: unknown) {
    return this.workspaces.update(user, slug, body)
  }

  @Delete('workspaces/:slug')
  remove(@CurrentUser() user: User, @Param('slug') slug: string, @Body() body: unknown) {
    return this.workspaces.remove(user, slug, body)
  }

  @Get('workspaces/:slug/members')
  members(@CurrentUser() user: User, @Param('slug') slug: string) {
    return this.workspaces.members(user, slug)
  }

  @Patch('workspaces/:slug/members/:userId')
  updateMember(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('userId') userId: string,
    @Body() body: unknown,
  ) {
    return this.workspaces.updateMember(user, slug, userId, body)
  }

  @Delete('workspaces/:slug/members/:userId')
  removeMember(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('userId') userId: string,
  ) {
    return this.workspaces.removeMember(user, slug, userId)
  }

  @Post('workspaces/:slug/invites')
  createInvite(@CurrentUser() user: User, @Param('slug') slug: string, @Body() body: unknown) {
    return this.workspaces.createInvite(user, slug, body)
  }

  @Get('workspaces/:slug/invites')
  listInvites(@CurrentUser() user: User, @Param('slug') slug: string) {
    return this.workspaces.listInvites(user, slug)
  }

  @Delete('workspaces/:slug/invites/:inviteId')
  revokeInvite(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('inviteId') inviteId: string,
  ) {
    return this.workspaces.revokeInvite(user, slug, inviteId)
  }

  @Public()
  @Get('invites/:token')
  previewInvite(@Param('token') token: string) {
    return this.workspaces.previewInvite(token)
  }

  @Post('invites/:token/accept')
  acceptInvite(@CurrentUser() user: User, @Param('token') token: string) {
    return this.workspaces.acceptInvite(user, token)
  }
}
