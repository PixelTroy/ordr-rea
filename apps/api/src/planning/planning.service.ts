import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Cycle, ModuleStatus, Prisma, User } from '@prisma/client'
import { MODULE_STATUSES } from '@ordr/shared'
import { z } from 'zod'
import { AccessService } from '../access/access.service'
import { WebhooksService } from '../platform/webhooks.service'
import { parseBody } from '../common/zod'
import { PrismaService } from '../prisma/prisma.service'

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const cycleSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(8000).optional(),
  startDate: dateString,
  endDate: dateString,
  leadId: z.string().nullable().optional(),
  memberIds: z.array(z.string()).optional(),
})

const cyclePatchSchema = cycleSchema.partial().extend({
  completed: z.boolean().optional(),
})

const moduleSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(8000).optional(),
  status: z.enum(MODULE_STATUSES).optional(),
  startDate: dateString.nullable().optional(),
  targetDate: dateString.nullable().optional(),
  leadId: z.string().nullable().optional(),
  memberIds: z.array(z.string()).optional(),
})

const idsSchema = z.object({ issueIds: z.array(z.string().min(1)).min(1) })

const userBrief = { select: { id: true, displayName: true, email: true, avatarColor: true } }

@Injectable()
export class PlanningService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(WebhooksService) private readonly hooks: WebhooksService,
  ) {}

  async createCycle(user: User, slug: string, projectId: string, body: unknown) {
    const data = parseBody(cycleSchema, body)
    const ctx = await this.access.project(slug, projectId, user.id, true)
    const start = this.date(data.startDate)
    const end = this.date(data.endDate)
    if (end < start) throw new BadRequestException('The end date is before the start date')
    await this.assertNoOverlap(ctx.project.id, start, end)
    if (data.leadId) await this.assertMember(ctx.workspace.id, data.leadId)
    const cycle = await this.prisma.cycle.create({
      data: {
        projectId: ctx.project.id,
        name: data.name,
        description: data.description ?? '',
        startDate: start,
        endDate: end,
        leadId: data.leadId ?? user.id,
        createdById: user.id,
        members: {
          create: this.unique([user.id, ...(data.memberIds ?? []), data.leadId].filter(Boolean) as string[]).map(
            (userId) => ({ userId }),
          ),
        },
      },
    })
    await this.hooks.emit(ctx.workspace.id, 'cycle.created', {
      id: cycle.id,
      name: cycle.name,
      projectId: ctx.project.id,
    })
    return { cycle: await this.cycleDetail(ctx.project.id, ctx.project.identifier, cycle.id) }
  }

  async listCycles(user: User, slug: string, projectId: string) {
    const ctx = await this.access.project(slug, projectId, user.id)
    const cycles = await this.prisma.cycle.findMany({
      where: { projectId: ctx.project.id },
      include: this.cycleInclude(),
      orderBy: { startDate: 'asc' },
    })
    return { cycles: cycles.map((cycle) => this.cycleSummary(cycle)) }
  }

  async getCycle(user: User, slug: string, projectId: string, cycleId: string) {
    const ctx = await this.access.project(slug, projectId, user.id)
    const cycle = await this.cycleDetail(ctx.project.id, ctx.project.identifier, cycleId)
    await this.prisma.recentVisit.upsert({
      where: { userId_entityType_entityId: { userId: user.id, entityType: 'cycle', entityId: cycleId } },
      update: { label: cycle.name, href: `/${slug}/projects/${projectId}/cycles/${cycleId}`, visitedAt: new Date() },
      create: {
        userId: user.id,
        workspaceId: ctx.workspace.id,
        entityType: 'cycle',
        entityId: cycleId,
        label: cycle.name,
        href: `/${slug}/projects/${projectId}/cycles/${cycleId}`,
      },
    })
    return { cycle }
  }

  async updateCycle(user: User, slug: string, projectId: string, cycleId: string, body: unknown) {
    const data = parseBody(cyclePatchSchema, body)
    const ctx = await this.access.project(slug, projectId, user.id, true)
    const existing = await this.requireCycle(ctx.project.id, cycleId)
    const start = data.startDate ? this.date(data.startDate) : existing.startDate
    const end = data.endDate ? this.date(data.endDate) : existing.endDate
    if (end < start) throw new BadRequestException('The end date is before the start date')
    if (data.startDate || data.endDate) await this.assertNoOverlap(ctx.project.id, start, end, existing.id)
    if (data.leadId) await this.assertMember(ctx.workspace.id, data.leadId)
    await this.prisma.cycle.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        description: data.description,
        startDate: data.startDate ? start : undefined,
        endDate: data.endDate ? end : undefined,
        leadId: data.leadId,
        completedAt: data.completed === undefined ? undefined : data.completed ? existing.completedAt ?? new Date() : null,
      },
    })
    if (data.memberIds) {
      for (const userId of data.memberIds) await this.assertMember(ctx.workspace.id, userId)
      await this.prisma.cycleMember.deleteMany({ where: { cycleId: existing.id } })
      if (data.memberIds.length) {
        await this.prisma.cycleMember.createMany({
          data: this.unique(data.memberIds).map((userId) => ({ cycleId: existing.id, userId })),
        })
      }
    }
    return { cycle: await this.cycleDetail(ctx.project.id, ctx.project.identifier, existing.id) }
  }

  async removeCycle(user: User, slug: string, projectId: string, cycleId: string) {
    const ctx = await this.access.project(slug, projectId, user.id, true)
    const existing = await this.requireCycle(ctx.project.id, cycleId)
    await this.prisma.cycle.delete({ where: { id: existing.id } })
    return { ok: true }
  }

  async addCycleIssues(user: User, slug: string, projectId: string, cycleId: string, body: unknown) {
    const data = parseBody(idsSchema, body)
    const ctx = await this.access.project(slug, projectId, user.id, true)
    const cycle = await this.requireCycle(ctx.project.id, cycleId)
    const issues = await this.prisma.issue.findMany({
      where: { projectId: ctx.project.id, id: { in: data.issueIds }, archivedAt: null },
    })
    if (issues.length !== this.unique(data.issueIds).length) throw new BadRequestException('Unknown work item')
    await this.prisma.$transaction(async (tx) => {
      for (const issue of issues) {
        await tx.cycleIssue.upsert({
          where: { issueId: issue.id },
          update: { cycleId: cycle.id },
          create: { cycleId: cycle.id, issueId: issue.id },
        })
        await tx.activity.create({
          data: {
            workspaceId: ctx.workspace.id,
            projectId: ctx.project.id,
            issueId: issue.id,
            actorId: user.id,
            action: 'updated',
            field: 'cycle',
            newValue: cycle.name,
          },
        })
      }
    })
    return { cycle: await this.cycleDetail(ctx.project.id, ctx.project.identifier, cycle.id) }
  }

  async removeCycleIssue(user: User, slug: string, projectId: string, cycleId: string, issueId: string) {
    const ctx = await this.access.project(slug, projectId, user.id, true)
    await this.requireCycle(ctx.project.id, cycleId)
    await this.prisma.cycleIssue.deleteMany({ where: { cycleId, issueId } })
    return { cycle: await this.cycleDetail(ctx.project.id, ctx.project.identifier, cycleId) }
  }

  async activeCycles(user: User, slug: string) {
    const { workspace, membership } = await this.access.workspace(slug, user.id)
    const projects = await this.prisma.project.findMany({
      where: { workspaceId: workspace.id, archivedAt: null },
      include: { members: { where: { userId: user.id }, select: { id: true } } },
    })
    const visible = projects.filter((project) => {
      const joined = project.members.length > 0
      if (membership.role === 'GUEST') return joined
      if (project.network === 'PRIVATE' && !joined && !this.access.isAdmin(membership)) return false
      return true
    })
    const cycles = await this.prisma.cycle.findMany({
      where: { projectId: { in: visible.map((project) => project.id) } },
      include: { ...this.cycleInclude(), project: { select: { id: true, name: true, identifier: true } } },
    })
    return {
      cycles: cycles
        .map((cycle) => ({ ...this.cycleSummary(cycle), project: cycle.project }))
        .filter((cycle) => cycle.status === 'ACTIVE'),
    }
  }

  async createModule(user: User, slug: string, projectId: string, body: unknown) {
    const data = parseBody(moduleSchema, body)
    const ctx = await this.access.project(slug, projectId, user.id, true)
    if (data.leadId) await this.assertMember(ctx.workspace.id, data.leadId)
    const start = data.startDate ? this.date(data.startDate) : null
    const target = data.targetDate ? this.date(data.targetDate) : null
    if (start && target && target < start) throw new BadRequestException('The end date is before the start date')
    const module = await this.prisma.module.create({
      data: {
        projectId: ctx.project.id,
        name: data.name,
        description: data.description ?? '',
        status: (data.status as ModuleStatus | undefined) ?? 'BACKLOG',
        startDate: start,
        targetDate: target,
        leadId: data.leadId ?? user.id,
        createdById: user.id,
        members: {
          create: this.unique([user.id, ...(data.memberIds ?? [])]).map((userId) => ({ userId })),
        },
      },
    })
    await this.hooks.emit(ctx.workspace.id, 'module.created', {
      id: module.id,
      name: module.name,
      projectId: ctx.project.id,
    })
    return { module: await this.moduleDetail(ctx.project.id, ctx.project.identifier, module.id) }
  }

  async listModules(user: User, slug: string, projectId: string) {
    const ctx = await this.access.project(slug, projectId, user.id)
    const modules = await this.prisma.module.findMany({
      where: { projectId: ctx.project.id },
      include: this.moduleInclude(),
      orderBy: { createdAt: 'asc' },
    })
    return { modules: modules.map((module) => this.moduleSummary(module)) }
  }

  async getModule(user: User, slug: string, projectId: string, moduleId: string) {
    const ctx = await this.access.project(slug, projectId, user.id)
    return { module: await this.moduleDetail(ctx.project.id, ctx.project.identifier, moduleId) }
  }

  async updateModule(user: User, slug: string, projectId: string, moduleId: string, body: unknown) {
    const data = parseBody(moduleSchema.partial(), body)
    const ctx = await this.access.project(slug, projectId, user.id, true)
    const existing = await this.requireModule(ctx.project.id, moduleId)
    if (data.leadId) await this.assertMember(ctx.workspace.id, data.leadId)
    const start = data.startDate === undefined ? existing.startDate : data.startDate ? this.date(data.startDate) : null
    const target = data.targetDate === undefined ? existing.targetDate : data.targetDate ? this.date(data.targetDate) : null
    if (start && target && target < start) throw new BadRequestException('The end date is before the start date')
    await this.prisma.module.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        description: data.description,
        status: data.status as ModuleStatus | undefined,
        startDate: data.startDate === undefined ? undefined : start,
        targetDate: data.targetDate === undefined ? undefined : target,
        leadId: data.leadId,
      },
    })
    if (data.memberIds) {
      await this.prisma.moduleMember.deleteMany({ where: { moduleId: existing.id } })
      if (data.memberIds.length) {
        await this.prisma.moduleMember.createMany({
          data: this.unique(data.memberIds).map((userId) => ({ moduleId: existing.id, userId })),
        })
      }
    }
    return { module: await this.moduleDetail(ctx.project.id, ctx.project.identifier, existing.id) }
  }

  async removeModule(user: User, slug: string, projectId: string, moduleId: string) {
    const ctx = await this.access.project(slug, projectId, user.id, true)
    const existing = await this.requireModule(ctx.project.id, moduleId)
    await this.prisma.module.delete({ where: { id: existing.id } })
    return { ok: true }
  }

  async addModuleIssues(user: User, slug: string, projectId: string, moduleId: string, body: unknown) {
    const data = parseBody(idsSchema, body)
    const ctx = await this.access.project(slug, projectId, user.id, true)
    const module = await this.requireModule(ctx.project.id, moduleId)
    const issues = await this.prisma.issue.findMany({
      where: { projectId: ctx.project.id, id: { in: this.unique(data.issueIds) }, archivedAt: null },
    })
    if (issues.length !== this.unique(data.issueIds).length) throw new BadRequestException('Unknown work item')
    await this.prisma.moduleIssue.createMany({
      data: issues.map((issue) => ({ moduleId: module.id, issueId: issue.id })),
      skipDuplicates: true,
    })
    return { module: await this.moduleDetail(ctx.project.id, ctx.project.identifier, module.id) }
  }

  async removeModuleIssue(user: User, slug: string, projectId: string, moduleId: string, issueId: string) {
    const ctx = await this.access.project(slug, projectId, user.id, true)
    await this.requireModule(ctx.project.id, moduleId)
    await this.prisma.moduleIssue.deleteMany({ where: { moduleId, issueId } })
    return { module: await this.moduleDetail(ctx.project.id, ctx.project.identifier, moduleId) }
  }

  private async cycleDetail(projectId: string, identifier: string, cycleId: string) {
    const cycle = await this.prisma.cycle.findFirst({
      where: { id: cycleId, projectId },
      include: this.cycleInclude(),
    })
    if (!cycle) throw new NotFoundException('Cycle not found')
    const summary = this.cycleSummary(cycle)
    return {
      ...summary,
      description: cycle.description,
      issues: cycle.issues.map((row) => this.issueBrief(row.issue, identifier)),
      createdBy: cycle.createdBy,
    }
  }

  private cycleSummary(cycle: Cycle & {
    lead: { id: string; displayName: string; email: string; avatarColor: string } | null
    members: Array<{ user: { id: string; displayName: string; email: string; avatarColor: string } }>
    issues: Array<{
      createdAt: Date
      issue: {
        id: string
        completedAt: Date | null
        state: { id: string; name: string; group: string }
        assignees: Array<{ user: { id: string; displayName: string; avatarColor: string } }>
        labels: Array<{ label: { id: string; name: string } }>
      }
    }>
  }) {
    const progress = this.progress(cycle)
    return {
      id: cycle.id,
      name: cycle.name,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      status: this.statusOf(cycle),
      lead: cycle.lead,
      members: cycle.members.map((member) => member.user),
      progress,
    }
  }

  private progress(cycle: {
    startDate: Date
    endDate: Date
    issues: Array<{
      issue: {
        completedAt: Date | null
        state: { group: string; name: string }
        assignees: Array<{ user: { id: string; displayName: string } }>
        labels: Array<{ label: { name: string } }>
      }
    }>
  }) {
    const issues = cycle.issues.map((row) => row.issue)
    const total = issues.length
    const completed = issues.filter((issue) => issue.state.group === 'COMPLETED' || issue.completedAt).length
    const byGroup = ['BACKLOG', 'UNSTARTED', 'STARTED', 'COMPLETED', 'CANCELLED'].map((group) => ({
      group,
      count: issues.filter((issue) => issue.state.group === group).length,
    }))
    const assigneeMap = new Map<string, { name: string; count: number }>()
    const labelMap = new Map<string, number>()
    for (const issue of issues) {
      for (const row of issue.assignees) {
        const current = assigneeMap.get(row.user.id) || { name: row.user.displayName, count: 0 }
        current.count += 1
        assigneeMap.set(row.user.id, current)
      }
      for (const row of issue.labels) labelMap.set(row.label.name, (labelMap.get(row.label.name) || 0) + 1)
    }
    const burndown = this.burndown(cycle.startDate, cycle.endDate, issues)
    const today = this.day(new Date())
    const point = burndown.find((row) => row.date === today) || burndown[burndown.length - 1]
    const leadBy = point ? Math.round((point.ideal - point.actual) * 10) / 10 : 0
    return {
      total,
      completed,
      percent: total ? Math.round((completed / total) * 100) : 0,
      byGroup,
      assignees: [...assigneeMap.entries()].map(([id, value]) => ({ id, ...value })),
      labels: [...labelMap.entries()].map(([name, count]) => ({ name, count })),
      burndown,
      leadBy,
    }
  }

  private burndown(start: Date, end: Date, issues: Array<{ completedAt: Date | null }>) {
    const days = this.eachDay(start, end).slice(0, 90)
    const scope = issues.length
    const span = Math.max(days.length - 1, 1)
    return days.map((date, index) => {
      const actual = issues.filter((issue) => !issue.completedAt || this.day(issue.completedAt) > date).length
      const ideal = Math.round((scope * (1 - index / span)) * 10) / 10
      return { date, ideal, actual }
    })
  }

  private async moduleDetail(projectId: string, identifier: string, moduleId: string) {
    const module = await this.prisma.module.findFirst({
      where: { id: moduleId, projectId },
      include: this.moduleInclude(),
    })
    if (!module) throw new NotFoundException('Module not found')
    return {
      ...this.moduleSummary(module),
      description: module.description,
      issues: module.issues.map((row) => this.issueBrief(row.issue, identifier)),
    }
  }

  private moduleSummary(module: {
    id: string
    name: string
    status: ModuleStatus
    startDate: Date | null
    targetDate: Date | null
    description?: string
    lead: { id: string; displayName: string; email: string; avatarColor: string } | null
    members: Array<{ user: { id: string; displayName: string; email: string; avatarColor: string } }>
    issues: Array<{ issue: { state: { group: string } } }>
  }) {
    const total = module.issues.length
    const completed = module.issues.filter((row) => row.issue.state.group === 'COMPLETED').length
    return {
      id: module.id,
      name: module.name,
      status: module.status,
      startDate: module.startDate,
      targetDate: module.targetDate,
      lead: module.lead,
      members: module.members.map((member) => member.user),
      progress: { total, completed, percent: total ? Math.round((completed / total) * 100) : 0 },
    }
  }

  private issueBrief(
    issue: {
      id: string
      sequenceId: number
      title: string
      priority: string
      startDate: Date | null
      dueDate: Date | null
      state: { id: string; name: string; color: string; group: string }
      assignees: Array<{ user: { id: string; displayName: string; avatarColor: string } }>
      labels: Array<{ label: { id: string; name: string; color: string } }>
    },
    identifier: string,
  ) {
    return {
      id: issue.id,
      key: `${identifier}-${issue.sequenceId}`,
      title: issue.title,
      priority: issue.priority,
      state: issue.state,
      assignees: issue.assignees.map((row) => row.user),
      labels: issue.labels.map((row) => row.label),
      startDate: issue.startDate,
      dueDate: issue.dueDate,
    }
  }

  private cycleInclude() {
    return {
      lead: userBrief,
      createdBy: userBrief,
      members: { include: { user: userBrief } },
      issues: {
        include: {
          issue: {
            include: {
              state: true,
              assignees: { include: { user: userBrief } },
              labels: { include: { label: true } },
            },
          },
        },
      },
    } satisfies Prisma.CycleInclude
  }

  private moduleInclude() {
    return {
      lead: userBrief,
      members: { include: { user: userBrief } },
      issues: {
        include: {
          issue: {
            include: {
              state: true,
              assignees: { include: { user: userBrief } },
              labels: { include: { label: true } },
            },
          },
        },
      },
    } satisfies Prisma.ModuleInclude
  }

  private async assertNoOverlap(projectId: string, start: Date, end: Date, ignoreId?: string) {
    const cycles = await this.prisma.cycle.findMany({ where: { projectId, id: ignoreId ? { not: ignoreId } : undefined } })
    const clash = cycles.find((cycle) => start <= cycle.endDate && cycle.startDate <= end)
    if (clash) {
      throw new BadRequestException(`Dates overlap ${clash.name}. A project can only have one active cycle, and ranges cannot overlap.`)
    }
  }

  private async requireCycle(projectId: string, cycleId: string) {
    const cycle = await this.prisma.cycle.findFirst({ where: { id: cycleId, projectId } })
    if (!cycle) throw new NotFoundException('Cycle not found')
    return cycle
  }

  private async requireModule(projectId: string, moduleId: string) {
    const module = await this.prisma.module.findFirst({ where: { id: moduleId, projectId } })
    if (!module) throw new NotFoundException('Module not found')
    return module
  }

  private async assertMember(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    })
    if (!member) throw new BadRequestException('That person is not in this workspace')
  }

  private statusOf(cycle: { startDate: Date; endDate: Date; completedAt: Date | null }) {
    const today = this.day(new Date())
    if (cycle.completedAt || this.day(cycle.endDate) < today) return 'COMPLETED' as const
    if (this.day(cycle.startDate) > today) return 'UPCOMING' as const
    return 'ACTIVE' as const
  }

  private date(value: string) {
    return new Date(`${value}T00:00:00.000Z`)
  }

  private day(value: Date) {
    return value.toISOString().slice(0, 10)
  }

  private eachDay(start: Date, end: Date) {
    const days: string[] = []
    const cursor = new Date(start)
    const last = this.day(end)
    while (this.day(cursor) <= last && days.length < 120) {
      days.push(this.day(cursor))
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    return days
  }

  private unique(values: string[]) {
    return [...new Set(values)]
  }
}
