import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Prisma, User } from '@prisma/client'
import { DEFAULT_STATES, PROJECT_ROLES } from '@ordr/shared'
import { z } from 'zod'
import { AccessService } from '../access/access.service'
import { WebhooksService } from '../platform/webhooks.service'
import { parseBody } from '../common/zod'
import { PrismaService } from '../prisma/prisma.service'

const identifierSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9]{1,5}$/, 'Use 2-6 letters or numbers, starting with a letter')

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  identifier: identifierSchema,
  description: z.string().max(4000).optional(),
  emoji: z.string().trim().min(1).max(8).optional(),
  coverColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  network: z.enum(['PUBLIC', 'PRIVATE']).optional(),
})

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().max(4000).optional(),
  emoji: z.string().trim().min(1).max(8).optional(),
  coverColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  network: z.enum(['PUBLIC', 'PRIVATE']).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  leadId: z.string().nullable().optional(),
  defaultAssigneeId: z.string().nullable().optional(),
  cyclesEnabled: z.boolean().optional(),
  modulesEnabled: z.boolean().optional(),
  viewsEnabled: z.boolean().optional(),
  pagesEnabled: z.boolean().optional(),
  intakeEnabled: z.boolean().optional(),
  timeTrackingEnabled: z.boolean().optional(),
  estimateType: z.enum(['NONE', 'POINTS', 'CATEGORIES']).optional(),
  archived: z.boolean().optional(),
})

const memberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(PROJECT_ROLES).default('MEMBER'),
})

const stateSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  group: z.enum(['BACKLOG', 'UNSTARTED', 'STARTED', 'COMPLETED', 'CANCELLED']),
})

const statePatchSchema = stateSchema.partial().extend({
  sequence: z.number().int().optional(),
  isDefault: z.boolean().optional(),
})

const labelSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
})

const userBrief = {
  select: { id: true, displayName: true, email: true, avatarColor: true },
}

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(WebhooksService) private readonly hooks: WebhooksService,
  ) {}

  async create(user: User, slug: string, body: unknown) {
    const data = parseBody(createSchema, body)
    const { workspace, membership } = await this.access.workspace(slug, user.id)
    if (membership.role === 'GUEST') throw new ForbiddenException('Guests cannot create projects')
    const taken = await this.prisma.project.findUnique({
      where: { workspaceId_identifier: { workspaceId: workspace.id, identifier: data.identifier } },
    })
    if (taken) throw new ConflictException('That project ID is already used')
    const project = await this.prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: data.name,
        identifier: data.identifier,
        description: data.description ?? '',
        emoji: data.emoji ?? '📁',
        coverColor: data.coverColor ?? '#3e4db5',
        network: data.network ?? 'PUBLIC',
        leadId: user.id,
        timezone: workspace.timezone,
        members: { create: { userId: user.id, role: 'ADMIN' } },
        states: {
          create: DEFAULT_STATES.map((state, index) => ({
            name: state.name,
            color: state.color,
            group: state.group,
            sequence: index,
            isDefault: state.isDefault,
          })),
        },
      },
      include: { lead: userBrief, _count: { select: { members: true } } },
    })
    await this.hooks.emit(workspace.id, 'project.created', {
      id: project.id,
      name: project.name,
      identifier: project.identifier,
    })
    return { project: this.present(project, true) }
  }

  async list(user: User, slug: string, archived = false) {
    const { workspace, membership } = await this.access.workspace(slug, user.id)
    const projects = await this.prisma.project.findMany({
      where: {
        workspaceId: workspace.id,
        archivedAt: archived ? { not: null } : null,
      },
      include: {
        lead: userBrief,
        members: { where: { userId: user.id }, select: { id: true } },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    const visible = projects.filter((project) => {
      const joined = project.members.length > 0
      if (membership.role === 'GUEST') return joined
      if (project.network === 'PRIVATE' && !joined && !this.access.isAdmin(membership)) return false
      return true
    })
    return {
      projects: visible.map((project) => this.present(project, project.members.length > 0)),
    }
  }

  async get(user: User, slug: string, projectId: string) {
    const ctx = await this.access.project(slug, projectId, user.id)
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: ctx.project.id },
      include: {
        lead: userBrief,
        defaultAssignee: userBrief,
        states: { orderBy: { sequence: 'asc' } },
        labels: { orderBy: { name: 'asc' } },
        members: { include: { user: userBrief }, orderBy: { createdAt: 'asc' } },
        _count: { select: { members: true, issues: true } },
      },
    })
    await this.remember(user.id, ctx.workspace.id, 'project', project.id, project.name, `/${slug}/projects/${project.id}/issues`)
    return {
      project: {
        ...this.present(project, Boolean(ctx.projectMember)),
        description: project.description,
        timezone: project.timezone,
        cyclesEnabled: project.cyclesEnabled,
        modulesEnabled: project.modulesEnabled,
        viewsEnabled: project.viewsEnabled,
        pagesEnabled: project.pagesEnabled,
        intakeEnabled: project.intakeEnabled,
        timeTrackingEnabled: project.timeTrackingEnabled,
        estimateType: project.estimateType,
        estimateScale: project.estimateScale,
        defaultAssignee: project.defaultAssignee,
        states: project.states,
        labels: project.labels,
        members: project.members.map((member) => ({
          id: member.id,
          role: member.role,
          joinedAt: member.createdAt,
          user: member.user,
        })),
        canWrite: ctx.canWrite,
        issueCount: project._count.issues,
      },
    }
  }

  async update(user: User, slug: string, projectId: string, body: unknown) {
    const data = parseBody(updateSchema, body)
    const ctx = await this.access.project(slug, projectId, user.id, true)
    if (data.leadId) await this.assertWorkspaceUser(ctx.workspace.id, data.leadId)
    if (data.defaultAssigneeId) await this.assertWorkspaceUser(ctx.workspace.id, data.defaultAssigneeId)
    const estimateScale =
      data.estimateType === 'POINTS'
        ? ['1', '2', '3', '5', '8']
        : data.estimateType === 'CATEGORIES'
          ? ['XS', 'S', 'M', 'L', 'XL']
          : data.estimateType === 'NONE'
            ? null
            : undefined
    const project = await this.prisma.project.update({
      where: { id: ctx.project.id },
      data: {
        name: data.name,
        description: data.description,
        emoji: data.emoji,
        coverColor: data.coverColor,
        network: data.network,
        timezone: data.timezone,
        leadId: data.leadId,
        defaultAssigneeId: data.defaultAssigneeId,
        cyclesEnabled: data.cyclesEnabled,
        modulesEnabled: data.modulesEnabled,
        viewsEnabled: data.viewsEnabled,
        pagesEnabled: data.pagesEnabled,
        intakeEnabled: data.intakeEnabled,
        timeTrackingEnabled: data.timeTrackingEnabled,
        estimateType: data.estimateType,
        estimateScale:
          estimateScale === undefined ? undefined : estimateScale === null ? Prisma.DbNull : estimateScale,
        archivedAt: data.archived === undefined ? undefined : data.archived ? new Date() : null,
      },
      include: { lead: userBrief, _count: { select: { members: true } } },
    })
    return { project: this.present(project, Boolean(ctx.projectMember)) }
  }

  async remove(user: User, slug: string, projectId: string) {
    const ctx = await this.access.project(slug, projectId, user.id, true)
    if (!this.access.isAdmin(ctx.membership) && ctx.projectMember?.role !== 'ADMIN') {
      throw new ForbiddenException('Only a project admin can delete it')
    }
    await this.prisma.project.delete({ where: { id: ctx.project.id } })
    return { ok: true }
  }

  async addMember(user: User, slug: string, projectId: string, body: unknown) {
    const data = parseBody(memberSchema, body)
    const ctx = await this.access.project(slug, projectId, user.id, true)
    await this.assertWorkspaceUser(ctx.workspace.id, data.userId)
    const member = await this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: ctx.project.id, userId: data.userId } },
      update: { role: data.role },
      create: { projectId: ctx.project.id, userId: data.userId, role: data.role },
      include: { user: userBrief },
    })
    return { member: { id: member.id, role: member.role, user: member.user } }
  }

  async removeMember(user: User, slug: string, projectId: string, memberUserId: string) {
    const ctx = await this.access.project(slug, projectId, user.id, true)
    if (memberUserId === ctx.project.leadId) throw new BadRequestException('Change the project lead before removing them')
    await this.prisma.projectMember.deleteMany({
      where: { projectId: ctx.project.id, userId: memberUserId },
    })
    return { ok: true }
  }

  async createState(user: User, slug: string, projectId: string, body: unknown) {
    const data = parseBody(stateSchema, body)
    const ctx = await this.access.project(slug, projectId, user.id, true)
    const last = await this.prisma.state.aggregate({
      where: { projectId: ctx.project.id, group: data.group },
      _max: { sequence: true },
    })
    const state = await this.prisma.state.create({
      data: {
        projectId: ctx.project.id,
        name: data.name,
        color: data.color,
        group: data.group,
        sequence: (last._max.sequence ?? -1) + 1,
      },
    })
    return { state }
  }

  async updateState(user: User, slug: string, projectId: string, stateId: string, body: unknown) {
    const data = parseBody(statePatchSchema, body)
    const ctx = await this.access.project(slug, projectId, user.id, true)
    const existing = await this.prisma.state.findFirst({ where: { id: stateId, projectId: ctx.project.id } })
    if (!existing) throw new NotFoundException('State not found')
    if (data.isDefault) {
      await this.prisma.state.updateMany({
        where: { projectId: ctx.project.id, isDefault: true },
        data: { isDefault: false },
      })
    }
    const state = await this.prisma.state.update({ where: { id: existing.id }, data })
    return { state }
  }

  async deleteState(user: User, slug: string, projectId: string, stateId: string) {
    const ctx = await this.access.project(slug, projectId, user.id, true)
    const existing = await this.prisma.state.findFirst({ where: { id: stateId, projectId: ctx.project.id } })
    if (!existing) throw new NotFoundException('State not found')
    const used = await this.prisma.issue.count({ where: { stateId } })
    if (used) throw new BadRequestException('Move work items out of this state first')
    const remaining = await this.prisma.state.count({ where: { projectId: ctx.project.id } })
    if (remaining <= 1) throw new BadRequestException('A project needs at least one state')
    await this.prisma.state.delete({ where: { id: stateId } })
    if (existing.isDefault) {
      const next = await this.prisma.state.findFirst({
        where: { projectId: ctx.project.id },
        orderBy: { sequence: 'asc' },
      })
      if (next) await this.prisma.state.update({ where: { id: next.id }, data: { isDefault: true } })
    }
    return { ok: true }
  }

  async createLabel(user: User, slug: string, projectId: string, body: unknown) {
    const data = parseBody(labelSchema, body)
    const ctx = await this.access.project(slug, projectId, user.id, true)
    try {
      const label = await this.prisma.label.create({
        data: { projectId: ctx.project.id, name: data.name, color: data.color },
      })
      return { label }
    } catch {
      throw new ConflictException('A label with that name already exists')
    }
  }

  async updateLabel(user: User, slug: string, projectId: string, labelId: string, body: unknown) {
    const data = parseBody(labelSchema.partial(), body)
    const ctx = await this.access.project(slug, projectId, user.id, true)
    const existing = await this.prisma.label.findFirst({ where: { id: labelId, projectId: ctx.project.id } })
    if (!existing) throw new NotFoundException('Label not found')
    const label = await this.prisma.label.update({ where: { id: labelId }, data })
    return { label }
  }

  async deleteLabel(user: User, slug: string, projectId: string, labelId: string) {
    const ctx = await this.access.project(slug, projectId, user.id, true)
    const existing = await this.prisma.label.findFirst({ where: { id: labelId, projectId: ctx.project.id } })
    if (!existing) throw new NotFoundException('Label not found')
    await this.prisma.label.delete({ where: { id: labelId } })
    return { ok: true }
  }

  async recents(user: User, slug: string) {
    const { workspace } = await this.access.workspace(slug, user.id)
    const visits = await this.prisma.recentVisit.findMany({
      where: { userId: user.id, workspaceId: workspace.id },
      orderBy: { visitedAt: 'desc' },
      take: 12,
    })
    return { recents: visits }
  }

  private present(
    project: {
      id: string
      name: string
      identifier: string
      emoji: string
      coverColor: string
      network: 'PUBLIC' | 'PRIVATE'
      description?: string
      archivedAt: Date | null
      createdAt: Date
      lead: { id: string; displayName: string; email: string; avatarColor: string } | null
      _count?: { members: number }
    },
    joined: boolean,
  ) {
    return {
      id: project.id,
      name: project.name,
      identifier: project.identifier,
      emoji: project.emoji,
      coverColor: project.coverColor,
      network: project.network,
      description: project.description ?? '',
      archivedAt: project.archivedAt,
      createdAt: project.createdAt,
      lead: project.lead,
      joined,
      memberCount: project._count?.members ?? 0,
    }
  }

  private async assertWorkspaceUser(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    })
    if (!member) throw new BadRequestException('That person is not in this workspace')
  }

  private async remember(
    userId: string,
    workspaceId: string,
    entityType: string,
    entityId: string,
    label: string,
    href: string,
  ) {
    await this.prisma.recentVisit.upsert({
      where: { userId_entityType_entityId: { userId, entityType, entityId } },
      update: { label, href, visitedAt: new Date() },
      create: { userId, workspaceId, entityType, entityId, label, href },
    })
  }
}
