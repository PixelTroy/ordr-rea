import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Prisma, StateGroup, User } from '@prisma/client'
import { DEFAULT_STATES, LAYOUTS, PAGE_ACCESS, PRIORITIES, STATE_GROUPS } from '@ordr/shared'
import { z } from 'zod'
import { AccessService } from '../access/access.service'
import { randomToken, sha256 } from '../auth/token.util'
import { parseBody } from '../common/zod'
import { PrismaService } from '../prisma/prisma.service'

const SCOPES = ['projects', 'cycles', 'issues', 'modules', 'comments'] as const
const VERBS = ['created', 'updated', 'archived', 'deleted'] as const

const filtersSchema = z.object({
  priority: z.string().max(20).optional(),
  stateId: z.string().max(80).optional(),
  assigneeId: z.string().max(80).optional(),
  labelId: z.string().max(80).optional(),
  search: z.string().max(200).optional(),
  cycleId: z.string().max(80).optional(),
  moduleId: z.string().max(80).optional(),
})

const viewSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional(),
  access: z.enum(PAGE_ACCESS).optional(),
  layout: z.enum(LAYOUTS).optional(),
  filters: filtersSchema.optional(),
})

const viewPatch = viewSchema.partial()

const tokenSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional(),
  expiresAt: z.string().nullable().optional(),
})

const webhookSchema = z.object({
  title: z.string().trim().min(1).max(120),
  url: z.string().trim().url().max(2000),
  events: z.object({
    v1: z.array(z.enum(SCOPES)).min(1),
    v2: z.array(z.enum(VERBS)).default([]),
  }),
})

const identifierSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9]{1,5}$/)

const importSchema = z.object({
  projects: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        identifier: identifierSchema,
        description: z.string().max(4000).optional(),
        states: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(40),
              color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
              group: z.enum(STATE_GROUPS),
            }),
          )
          .max(20)
          .optional(),
        labels: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(40),
              color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
            }),
          )
          .max(50)
          .optional(),
        issues: z
          .array(
            z.object({
              title: z.string().trim().min(1).max(255),
              description: z.string().max(20000).optional(),
              priority: z.enum(PRIORITIES).optional(),
              stateName: z.string().max(40).optional(),
              labelNames: z.array(z.string()).max(20).optional(),
            }),
          )
          .max(200)
          .optional(),
      }),
    )
    .max(20),
})

type SearchHit = { type: string; id: string; title: string; href: string; subtitle: string }

@Injectable()
export class PlatformService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessService) private readonly access: AccessService,
  ) {}

  async listViews(user: User, slug: string, projectId: string) {
    const ctx = await this.access.project(slug, projectId, user.id)
    const views = await this.prisma.savedView.findMany({
      where: { projectId: ctx.project.id, ...this.visibleWhere(user.id, this.access.isAdmin(ctx.membership)) },
      include: { favorites: { where: { userId: user.id }, select: { userId: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return { views: views.map((view) => this.presentView(view)) }
  }

  async createView(user: User, slug: string, projectId: string, body: unknown) {
    const data = parseBody(viewSchema, body)
    const ctx = await this.access.project(slug, projectId, user.id, true)
    const view = await this.prisma.savedView.create({
      data: {
        workspaceId: ctx.workspace.id,
        projectId: ctx.project.id,
        name: data.name,
        description: data.description ?? '',
        access: data.access ?? 'PUBLIC',
        layout: data.layout ?? 'LIST',
        filters: (data.filters ?? {}) as Prisma.InputJsonValue,
        createdById: user.id,
      },
      include: { favorites: { where: { userId: user.id }, select: { userId: true } } },
    })
    return { view: this.presentView(view) }
  }

  async getView(user: User, slug: string, projectId: string, viewId: string) {
    const ctx = await this.access.project(slug, projectId, user.id)
    const view = await this.requireView(ctx.project.id, viewId, user.id, this.access.isAdmin(ctx.membership))
    return { view: this.presentView(view) }
  }

  async updateView(user: User, slug: string, projectId: string, viewId: string, body: unknown) {
    const data = parseBody(viewPatch, body)
    const ctx = await this.access.project(slug, projectId, user.id, true)
    const existing = await this.requireView(ctx.project.id, viewId, user.id, this.access.isAdmin(ctx.membership))
    if (existing.createdById !== user.id && !this.access.isAdmin(ctx.membership)) {
      throw new ForbiddenException('Only the creator can edit this view')
    }
    const view = await this.prisma.savedView.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        description: data.description,
        access: data.access,
        layout: data.layout,
        filters: data.filters ? (data.filters as Prisma.InputJsonValue) : undefined,
      },
      include: { favorites: { where: { userId: user.id }, select: { userId: true } } },
    })
    return { view: this.presentView(view) }
  }

  async removeView(user: User, slug: string, projectId: string, viewId: string) {
    const ctx = await this.access.project(slug, projectId, user.id, true)
    const existing = await this.requireView(ctx.project.id, viewId, user.id, this.access.isAdmin(ctx.membership))
    if (existing.createdById !== user.id && !this.access.isAdmin(ctx.membership)) {
      throw new ForbiddenException('Only the creator can delete this view')
    }
    await this.prisma.savedView.delete({ where: { id: existing.id } })
    return { ok: true }
  }

  async toggleFavorite(user: User, slug: string, projectId: string, viewId: string) {
    const ctx = await this.access.project(slug, projectId, user.id)
    const existing = await this.requireView(ctx.project.id, viewId, user.id, this.access.isAdmin(ctx.membership))
    const favorite = await this.prisma.viewFavorite.findUnique({
      where: { viewId_userId: { viewId: existing.id, userId: user.id } },
    })
    if (favorite) {
      await this.prisma.viewFavorite.delete({ where: { viewId_userId: { viewId: existing.id, userId: user.id } } })
    } else {
      await this.prisma.viewFavorite.create({ data: { viewId: existing.id, userId: user.id } })
    }
    const view = await this.requireView(ctx.project.id, viewId, user.id, this.access.isAdmin(ctx.membership))
    return { view: this.presentView(view) }
  }

  async search(user: User, slug: string, q: string) {
    const query = q.trim().slice(0, 200)
    if (!query) return { results: [] as SearchHit[] }
    const { workspace, membership } = await this.access.workspace(slug, user.id)
    const projects = await this.visibleProjects(workspace.id, user.id, membership)
    const ids = projects.map((project) => project.id)
    const admin = this.access.isAdmin(membership)
    const key = /^([A-Za-z][A-Za-z0-9]{1,5})-(\d+)$/.exec(query)
    const [issues, cycles, modules, pages] = await Promise.all([
      this.prisma.issue.findMany({
        where: {
          projectId: { in: ids },
          archivedAt: null,
          isDraft: false,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            ...(key
              ? [{ project: { identifier: key[1].toUpperCase() }, sequenceId: Number(key[2]) }]
              : []),
          ],
        },
        include: { project: { select: { identifier: true, id: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      this.prisma.cycle.findMany({
        where: { projectId: { in: ids }, name: { contains: query, mode: 'insensitive' } },
        include: { project: { select: { id: true, name: true } } },
        take: 8,
      }),
      this.prisma.module.findMany({
        where: { projectId: { in: ids }, name: { contains: query, mode: 'insensitive' } },
        include: { project: { select: { id: true, name: true } } },
        take: 8,
      }),
      this.prisma.page.findMany({
        where: {
          workspaceId: workspace.id,
          archivedAt: null,
          title: { contains: query, mode: 'insensitive' },
          AND: [
            { OR: [{ projectId: null }, { projectId: { in: ids } }] },
            ...(admin ? [] : [{ OR: [{ access: 'PUBLIC' as const }, { createdById: user.id }] }]),
          ],
        },
        take: 8,
      }),
    ])
    const projectHits = projects
      .filter((project) => project.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 8)
      .map((project) => ({
        type: 'project',
        id: project.id,
        title: project.name,
        href: `/${slug}/projects/${project.id}/issues`,
        subtitle: project.identifier,
      }))
    const results: SearchHit[] = [
      ...issues.map((issue) => ({
        type: 'issue',
        id: issue.id,
        title: issue.title,
        href: `/${slug}/browse/${issue.project.identifier}-${issue.sequenceId}`,
        subtitle: `${issue.project.identifier}-${issue.sequenceId}`,
      })),
      ...projectHits,
      ...cycles.map((cycle) => ({
        type: 'cycle',
        id: cycle.id,
        title: cycle.name,
        href: `/${slug}/projects/${cycle.project.id}/cycles/${cycle.id}`,
        subtitle: cycle.project.name,
      })),
      ...modules.map((module) => ({
        type: 'module',
        id: module.id,
        title: module.name,
        href: `/${slug}/projects/${module.project.id}/modules/${module.id}`,
        subtitle: module.project.name,
      })),
      ...pages.map((page) => ({
        type: 'page',
        id: page.id,
        title: page.title,
        href: page.projectId ? `/${slug}/projects/${page.projectId}/pages/${page.id}` : `/${slug}/wiki/${page.id}`,
        subtitle: page.projectId ? 'Project page' : 'Wiki',
      })),
    ]
    return { results }
  }

  async exportWorkspace(user: User, slug: string) {
    const { workspace, membership } = await this.access.workspace(slug, user.id)
    const visible = await this.visibleProjects(workspace.id, user.id, membership)
    const projects = await this.prisma.project.findMany({
      where: { id: { in: visible.map((project) => project.id) } },
      include: {
        states: { orderBy: { sequence: 'asc' } },
        labels: { orderBy: { name: 'asc' } },
        issues: {
          where: { archivedAt: null, isDraft: false, parentId: null },
          include: { state: true, labels: { include: { label: true } } },
          orderBy: { sequenceId: 'asc' },
        },
      },
      orderBy: { identifier: 'asc' },
    })
    return {
      projects: projects.map((project) => ({
        name: project.name,
        identifier: project.identifier,
        description: project.description,
        states: project.states.map((state) => ({ name: state.name, color: state.color, group: state.group })),
        labels: project.labels.map((label) => ({ name: label.name, color: label.color })),
        issues: project.issues.map((issue) => ({
          title: issue.title,
          description: issue.description,
          priority: issue.priority,
          stateName: issue.state.name,
          labelNames: issue.labels.map((row) => row.label.name),
        })),
      })),
    }
  }

  async importWorkspace(user: User, slug: string, body: unknown) {
    const data = parseBody(importSchema, body)
    const { workspace, membership } = await this.access.workspace(slug, user.id)
    if (!this.access.isAdmin(membership)) throw new ForbiddenException('Only admins can import')
    const counts = await this.prisma.$transaction(async (tx) => {
      let projectCount = 0
      let issueCount = 0
      for (const item of data.projects) {
        const taken = await tx.project.findUnique({
          where: { workspaceId_identifier: { workspaceId: workspace.id, identifier: item.identifier } },
        })
        if (taken) throw new ConflictException(`Project ID ${item.identifier} already exists`)
        const states = item.states?.length
          ? item.states
          : DEFAULT_STATES.map((state) => ({ name: state.name, color: state.color, group: state.group }))
        const defaultIndex = Math.max(
          0,
          states.findIndex((state) => state.group === 'BACKLOG'),
        )
        const project = await tx.project.create({
          data: {
            workspaceId: workspace.id,
            name: item.name,
            identifier: item.identifier,
            description: item.description ?? '',
            leadId: user.id,
            timezone: workspace.timezone,
            members: { create: { userId: user.id, role: 'ADMIN' } },
            states: {
              create: states.map((state, index) => ({
                name: state.name,
                color: state.color || '#60646c',
                group: state.group as StateGroup,
                sequence: index,
                isDefault: index === defaultIndex,
              })),
            },
            labels: {
              create: (item.labels ?? []).map((label) => ({ name: label.name, color: label.color || '#3e4db5' })),
            },
          },
          include: { states: true, labels: true },
        })
        projectCount += 1
        for (const issue of item.issues ?? []) {
          const state =
            project.states.find((candidate) => candidate.name === issue.stateName) ||
            project.states.find((candidate) => candidate.isDefault) ||
            project.states[0]
          const counter = await tx.project.update({
            where: { id: project.id },
            data: { issueCounter: { increment: 1 } },
          })
          const labelIds = project.labels
            .filter((label) => (issue.labelNames ?? []).includes(label.name))
            .map((label) => label.id)
          await tx.issue.create({
            data: {
              projectId: project.id,
              sequenceId: counter.issueCounter,
              title: issue.title,
              description: issue.description ?? '',
              priority: issue.priority ?? 'NONE',
              stateId: state.id,
              createdById: user.id,
              sortOrder: Date.now(),
              labels: { create: labelIds.map((labelId) => ({ labelId })) },
            },
          })
          issueCount += 1
        }
      }
      return { projects: projectCount, issues: issueCount }
    })
    return counts
  }

  async listTokens(user: User, slug: string) {
    const { workspace } = await this.access.workspace(slug, user.id)
    const tokens = await this.prisma.apiToken.findMany({
      where: { workspaceId: workspace.id, userId: user.id },
      orderBy: { createdAt: 'desc' },
    })
    return {
      tokens: tokens.map((token) => ({
        id: token.id,
        title: token.title,
        description: token.description,
        prefix: token.prefix,
        expiresAt: token.expiresAt,
        lastUsedAt: token.lastUsedAt,
        createdAt: token.createdAt,
      })),
    }
  }

  async createToken(user: User, slug: string, body: unknown) {
    const data = parseBody(tokenSchema, body)
    const { workspace, membership } = await this.access.workspace(slug, user.id)
    if (membership.role === 'GUEST') throw new ForbiddenException('Guests cannot create access tokens')
    const expiresAt = this.expiry(data.expiresAt)
    const plaintext = `ordr_${randomToken(24)}`
    const token = await this.prisma.apiToken.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        title: data.title,
        description: data.description ?? '',
        tokenHash: sha256(plaintext),
        prefix: plaintext.slice(0, 12),
        expiresAt,
      },
    })
    return {
      token: plaintext,
      accessToken: {
        id: token.id,
        title: token.title,
        description: token.description,
        prefix: token.prefix,
        expiresAt: token.expiresAt,
        createdAt: token.createdAt,
      },
    }
  }

  async removeToken(user: User, slug: string, tokenId: string) {
    const { workspace } = await this.access.workspace(slug, user.id)
    const token = await this.prisma.apiToken.findFirst({
      where: { id: tokenId, workspaceId: workspace.id, userId: user.id },
    })
    if (!token) throw new NotFoundException('Access token not found')
    await this.prisma.apiToken.delete({ where: { id: token.id } })
    return { ok: true }
  }

  async listWebhooks(user: User, slug: string) {
    const { workspace, membership } = await this.access.workspace(slug, user.id)
    if (!this.access.isAdmin(membership)) throw new ForbiddenException('Only admins can view webhooks')
    const webhooks = await this.prisma.webhook.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { deliveries: true } } },
    })
    return {
      webhooks: webhooks.map((hook) => ({
        id: hook.id,
        title: hook.title,
        url: hook.url,
        events: hook.events,
        isActive: hook.isActive,
        createdAt: hook.createdAt,
        deliveryCount: hook._count.deliveries,
      })),
    }
  }

  async createWebhook(user: User, slug: string, body: unknown) {
    const data = parseBody(webhookSchema, body)
    const { workspace, membership } = await this.access.workspace(slug, user.id)
    if (!this.access.isAdmin(membership)) throw new ForbiddenException('Only admins can create webhooks')
    const secret = randomToken(24)
    const webhook = await this.prisma.webhook.create({
      data: {
        workspaceId: workspace.id,
        title: data.title,
        url: data.url,
        secret,
        events: data.events as Prisma.InputJsonValue,
        createdById: user.id,
      },
    })
    return {
      webhook: {
        id: webhook.id,
        title: webhook.title,
        url: webhook.url,
        events: webhook.events,
        isActive: webhook.isActive,
        secret,
        createdAt: webhook.createdAt,
      },
    }
  }

  async getWebhook(user: User, slug: string, webhookId: string) {
    const { workspace, membership } = await this.access.workspace(slug, user.id)
    if (!this.access.isAdmin(membership)) throw new ForbiddenException('Only admins can view webhooks')
    const webhook = await this.prisma.webhook.findFirst({
      where: { id: webhookId, workspaceId: workspace.id },
      include: { deliveries: { orderBy: { createdAt: 'desc' }, take: 20 } },
    })
    if (!webhook) throw new NotFoundException('Webhook not found')
    return {
      webhook: {
        id: webhook.id,
        title: webhook.title,
        url: webhook.url,
        events: webhook.events,
        isActive: webhook.isActive,
        secret: webhook.secret,
        createdAt: webhook.createdAt,
        deliveries: webhook.deliveries,
      },
    }
  }

  async removeWebhook(user: User, slug: string, webhookId: string) {
    const { workspace, membership } = await this.access.workspace(slug, user.id)
    if (!this.access.isAdmin(membership)) throw new ForbiddenException('Only admins can delete webhooks')
    const webhook = await this.prisma.webhook.findFirst({ where: { id: webhookId, workspaceId: workspace.id } })
    if (!webhook) throw new NotFoundException('Webhook not found')
    await this.prisma.webhook.delete({ where: { id: webhook.id } })
    return { ok: true }
  }

  private visibleWhere(userId: string, admin: boolean): Prisma.SavedViewWhereInput {
    if (admin) return {}
    return { OR: [{ access: 'PUBLIC' }, { createdById: userId }] }
  }

  private async requireView(projectId: string, viewId: string, userId: string, admin: boolean) {
    const view = await this.prisma.savedView.findFirst({
      where: { id: viewId, projectId, ...this.visibleWhere(userId, admin) },
      include: { favorites: { where: { userId }, select: { userId: true } } },
    })
    if (!view) throw new NotFoundException('View not found')
    return view
  }

  private presentView(view: {
    id: string
    projectId: string | null
    name: string
    description: string
    access: string
    layout: string
    filters: Prisma.JsonValue
    createdById: string
    createdAt: Date
    updatedAt: Date
    favorites: Array<{ userId: string }>
  }) {
    const filters =
      view.filters && typeof view.filters === 'object' && !Array.isArray(view.filters) ? view.filters : {}
    return {
      id: view.id,
      projectId: view.projectId,
      name: view.name,
      description: view.description,
      access: view.access,
      layout: view.layout,
      filters,
      createdById: view.createdById,
      favorited: view.favorites.length > 0,
      createdAt: view.createdAt,
      updatedAt: view.updatedAt,
    }
  }

  private async visibleProjects(
    workspaceId: string,
    userId: string,
    membership: { role: string; isOwner: boolean },
  ) {
    const projects = await this.prisma.project.findMany({
      where: { workspaceId, archivedAt: null },
      include: { members: { where: { userId }, select: { id: true } } },
    })
    return projects.filter((project) => {
      const joined = project.members.length > 0
      if (membership.role === 'GUEST') return joined
      if (project.network === 'PRIVATE' && !joined && !this.access.isAdmin(membership)) return false
      return true
    })
  }

  private expiry(value: string | null | undefined) {
    if (!value) return null
    const date = new Date(value.length === 10 ? `${value}T23:59:59.000Z` : value)
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Expiration date is invalid')
    if (date.getTime() <= Date.now()) throw new BadRequestException('Expiration date is in the past')
    return date
  }
}
