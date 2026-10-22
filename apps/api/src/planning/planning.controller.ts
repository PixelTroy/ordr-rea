import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from '@nestjs/common'
import { User } from '@prisma/client'
import { CurrentUser } from '../auth/current-user.decorator'
import { PlanningService } from './planning.service'

@Controller('v1/workspaces/:slug')
export class PlanningController {
  constructor(@Inject(PlanningService) private readonly planning: PlanningService) {}

  @Get('active-cycles')
  active(@CurrentUser() user: User, @Param('slug') slug: string) {
    return this.planning.activeCycles(user, slug)
  }

  @Post('projects/:projectId/cycles')
  createCycle(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Body() body: unknown,
  ) {
    return this.planning.createCycle(user, slug, projectId, body)
  }

  @Get('projects/:projectId/cycles')
  listCycles(@CurrentUser() user: User, @Param('slug') slug: string, @Param('projectId') projectId: string) {
    return this.planning.listCycles(user, slug, projectId)
  }

  @Get('projects/:projectId/cycles/:cycleId')
  getCycle(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('cycleId') cycleId: string,
  ) {
    return this.planning.getCycle(user, slug, projectId, cycleId)
  }

  @Patch('projects/:projectId/cycles/:cycleId')
  updateCycle(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('cycleId') cycleId: string,
    @Body() body: unknown,
  ) {
    return this.planning.updateCycle(user, slug, projectId, cycleId, body)
  }

  @Delete('projects/:projectId/cycles/:cycleId')
  removeCycle(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('cycleId') cycleId: string,
  ) {
    return this.planning.removeCycle(user, slug, projectId, cycleId)
  }

  @Post('projects/:projectId/cycles/:cycleId/issues')
  addCycleIssues(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('cycleId') cycleId: string,
    @Body() body: unknown,
  ) {
    return this.planning.addCycleIssues(user, slug, projectId, cycleId, body)
  }

  @Delete('projects/:projectId/cycles/:cycleId/issues/:issueId')
  removeCycleIssue(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('cycleId') cycleId: string,
    @Param('issueId') issueId: string,
  ) {
    return this.planning.removeCycleIssue(user, slug, projectId, cycleId, issueId)
  }

  @Post('projects/:projectId/modules')
  createModule(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Body() body: unknown,
  ) {
    return this.planning.createModule(user, slug, projectId, body)
  }

  @Get('projects/:projectId/modules')
  listModules(@CurrentUser() user: User, @Param('slug') slug: string, @Param('projectId') projectId: string) {
    return this.planning.listModules(user, slug, projectId)
  }

  @Get('projects/:projectId/modules/:moduleId')
  getModule(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('moduleId') moduleId: string,
  ) {
    return this.planning.getModule(user, slug, projectId, moduleId)
  }

  @Patch('projects/:projectId/modules/:moduleId')
  updateModule(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('moduleId') moduleId: string,
    @Body() body: unknown,
  ) {
    return this.planning.updateModule(user, slug, projectId, moduleId, body)
  }

  @Delete('projects/:projectId/modules/:moduleId')
  removeModule(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('moduleId') moduleId: string,
  ) {
    return this.planning.removeModule(user, slug, projectId, moduleId)
  }

  @Post('projects/:projectId/modules/:moduleId/issues')
  addModuleIssues(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('moduleId') moduleId: string,
    @Body() body: unknown,
  ) {
    return this.planning.addModuleIssues(user, slug, projectId, moduleId, body)
  }

  @Delete('projects/:projectId/modules/:moduleId/issues/:issueId')
  removeModuleIssue(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Param('projectId') projectId: string,
    @Param('moduleId') moduleId: string,
    @Param('issueId') issueId: string,
  ) {
    return this.planning.removeModuleIssue(user, slug, projectId, moduleId, issueId)
  }
}
