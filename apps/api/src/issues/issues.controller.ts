import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Put, Query } from '@nestjs/common'
import { User } from '@prisma/client'
import { CurrentUser } from '../auth/current-user.decorator'
import { IssuesService } from './issues.service'

@Controller('v1/workspaces/:slug')
export class IssuesController {
  constructor(@Inject(IssuesService) private readonly issues: IssuesService) {}

  @Get('work-items')
  listWorkspace(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.issues.listWorkspace(user, slug, query)
  }

  @Get('browse/:key')
  browse(@CurrentUser() user: User, @Param('slug') slug: string, @Param('key') key: string) {
    return this.issues.browse(user, slug, key)
  }

  @Get('attachments/:attachmentId')
  download(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.issues.downloadAttachment(user, slug, attachmentId)
  }

  @Get('projects/:projectId/issues')
  list(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.issues.list(user, slug, projectId, query)
  }

  @Post('projects/:projectId/issues')
  create(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Body() body: unknown,
  ) {
    return this.issues.create(user, slug, projectId, body)
  }

  @Patch('projects/:projectId/issues/:issueId')
  update(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Body() body: unknown,
  ) {
    return this.issues.update(user, slug, projectId, issueId, body)
  }

  @Put('projects/:projectId/issues/:issueId/assignees')
  assignees(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Body() body: { assigneeIds?: string[] },
  ) {
    return this.issues.setAssignees(user, slug, projectId, issueId, body.assigneeIds ?? [])
  }

  @Put('projects/:projectId/issues/:issueId/labels')
  labels(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Body() body: { labelIds?: string[] },
  ) {
    return this.issues.setLabels(user, slug, projectId, issueId, body.labelIds ?? [])
  }

  @Post('projects/:projectId/issues/:issueId/relations')
  addRelation(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Body() body: unknown,
  ) {
    return this.issues.addRelation(user, slug, projectId, issueId, body)
  }

  @Delete('projects/:projectId/relations/:relationId')
  removeRelation(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('relationId') relationId: string,
  ) {
    return this.issues.removeRelation(user, slug, projectId, relationId)
  }

  @Post('projects/:projectId/issues/:issueId/links')
  addLink(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Body() body: unknown,
  ) {
    return this.issues.addLink(user, slug, projectId, issueId, body)
  }

  @Delete('projects/:projectId/links/:linkId')
  removeLink(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('linkId') linkId: string,
  ) {
    return this.issues.removeLink(user, slug, projectId, linkId)
  }

  @Post('projects/:projectId/issues/:issueId/attachments')
  addAttachment(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Body() body: unknown,
  ) {
    return this.issues.addAttachment(user, slug, projectId, issueId, body)
  }

  @Post('projects/:projectId/issues/:issueId/vote')
  vote(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Body() body: { value?: number },
  ) {
    return this.issues.vote(user, slug, projectId, issueId, Number(body.value))
  }

  @Post('projects/:projectId/issues/:issueId/subscription')
  subscribe(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Body() body: { subscribed?: boolean },
  ) {
    return this.issues.subscribe(user, slug, projectId, issueId, Boolean(body.subscribed))
  }

  @Get('projects/:projectId/intake')
  listIntake(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Query('closed') closed?: string,
  ) {
    return this.issues.listIntake(user, slug, projectId, closed === '1')
  }

  @Post('projects/:projectId/intake')
  createIntake(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Body() body: unknown,
  ) {
    return this.issues.createIntake(user, slug, projectId, body)
  }

  @Post('projects/:projectId/intake/:intakeId/accept')
  acceptIntake(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('intakeId') intakeId: string,
  ) {
    return this.issues.acceptIntake(user, slug, projectId, intakeId)
  }

  @Post('projects/:projectId/intake/:intakeId/decline')
  declineIntake(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('intakeId') intakeId: string,
  ) {
    return this.issues.declineIntake(user, slug, projectId, intakeId)
  }
}
