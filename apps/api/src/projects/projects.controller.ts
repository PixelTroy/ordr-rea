import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common'
import { User } from '@prisma/client'
import { CurrentUser } from '../auth/current-user.decorator'
import { ProjectsService } from './projects.service'

@Controller('v1/workspaces/:slug')
export class ProjectsController {
  constructor(@Inject(ProjectsService) private readonly projects: ProjectsService) {}

  @Post('projects')
  create(@CurrentUser() user: User, @Param('slug') slug: string, @Body() body: unknown) {
    return this.projects.create(user, slug, body)
  }

  @Get('projects')
  list(@CurrentUser() user: User, @Param('slug') slug: string, @Query('archived') archived?: string) {
    return this.projects.list(user, slug, archived === '1')
  }

  @Get('recents')
  recents(@CurrentUser() user: User, @Param('slug') slug: string) {
    return this.projects.recents(user, slug)
  }

  @Get('projects/:projectId')
  get(@CurrentUser() user: User, @Param('slug') slug: string, @Param('projectId') projectId: string) {
    return this.projects.get(user, slug, projectId)
  }

  @Patch('projects/:projectId')
  update(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Body() body: unknown,
  ) {
    return this.projects.update(user, slug, projectId, body)
  }

  @Delete('projects/:projectId')
  remove(@CurrentUser() user: User, @Param('slug') slug: string, @Param('projectId') projectId: string) {
    return this.projects.remove(user, slug, projectId)
  }

  @Post('projects/:projectId/members')
  addMember(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Body() body: unknown,
  ) {
    return this.projects.addMember(user, slug, projectId, body)
  }

  @Delete('projects/:projectId/members/:userId')
  removeMember(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
  ) {
    return this.projects.removeMember(user, slug, projectId, userId)
  }

  @Post('projects/:projectId/states')
  createState(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Body() body: unknown,
  ) {
    return this.projects.createState(user, slug, projectId, body)
  }

  @Patch('projects/:projectId/states/:stateId')
  updateState(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('stateId') stateId: string,
    @Body() body: unknown,
  ) {
    return this.projects.updateState(user, slug, projectId, stateId, body)
  }

  @Delete('projects/:projectId/states/:stateId')
  deleteState(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('stateId') stateId: string,
  ) {
    return this.projects.deleteState(user, slug, projectId, stateId)
  }

  @Post('projects/:projectId/labels')
  createLabel(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Body() body: unknown,
  ) {
    return this.projects.createLabel(user, slug, projectId, body)
  }

  @Patch('projects/:projectId/labels/:labelId')
  updateLabel(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('labelId') labelId: string,
    @Body() body: unknown,
  ) {
    return this.projects.updateLabel(user, slug, projectId, labelId, body)
  }

  @Delete('projects/:projectId/labels/:labelId')
  deleteLabel(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('labelId') labelId: string,
  ) {
    return this.projects.deleteLabel(user, slug, projectId, labelId)
  }
}
