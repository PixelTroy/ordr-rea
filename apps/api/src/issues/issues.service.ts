import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common'
import { Prisma, Priority, StateGroup, User } from '@prisma/client'
import { ISSUE_RELATION_TYPES, PRIORITIES } from '@ordr/shared'
import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import { z } from 'zod'
import { AccessService } from '../access/access.service'
import { randomToken } from '../auth/token.util'
import { parseBody } from '../common/zod'
import { PrismaService } from '../prisma/prisma.service'

const dateField = z.string().nullable().optional()

const createSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().max(20000).optional(),
  stateId: z.string().optional(),
  priority: z.enum(PRIORITIES).optional(),
  assigneeIds: z.array(z.string()).optional(),
  labelIds: z.array(z.string()).optional(),
  startDate: dateField,
  dueDate: dateField,
  parentId: z.string().nullable().optional(),
  estimate: z.string().max(16).nullable().optional(),
  isDraft: z.boolean().optional(),
  cycleId: z.string().optional(),
  moduleIds: z.array(z.string()).optional(),
})

const updateSchema = createSchema.partial().extend({
  sortOrder: z.number().optional(),
  archived: z.boolean().optional(),
})

const relationSchema = z.object({
  relatedKey: z.string().regex(/^[A-Z][A-Z0-9]{1,5}-\d+$/),
  type: z.enum(ISSUE_RELATION_TYPES),
})

const linkSchema = z.object({
  url: z.string().trim().url().max(2000),
  title: z.string().trim().min(1).max(200),
})

const attachmentSchema = z.object({
  filename: z.string().trim().min(1).max(180),
  mimeType: z.string().trim().min(1).max(120),
  dataBase64: z.string().min(1),
})

const intakeSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().max(20000).optional(),
})

const userBrief = { select: { id: true, displayName: true, email: true, avatarColor: true } }

type Db = Prisma.TransactionClient | PrismaService

@Injectable()
export class IssuesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessService) private readonly access: AccessService,
  ) {}

  async create(user: User, slug: string, projectId: string, body: unknown) {
    const data = parseBody(createSchema, body)
    const ctx = await this.access.project(slug, projectId, user.id, true)
    const issue = await this.prisma.$transaction(async (tx) => {
      const state = await this.resolveState(tx, ctx.project.id, data.stateId)
      await this.assertParent(tx, ctx.project.id, 'new', data.parentId ?? null)
      if (data.cycleId) {
        const cycle = await tx.cycle.findFirst({ where: { id: data.cycleId, projectId: ctx.project.id } })
        if (!cycle) throw new BadRequestException('Cycle not found')
      }
      if (data.moduleIds?.length) {
        const found = await tx.module.count({ where: { projectId: ctx.project.id, id: { in: data.moduleIds } } })
        if (found !== new Set(data.moduleIds).size) throw new BadRequestException('Module not found')
      }
      const counter = await tx.project.update({
        where: { id: ctx.project.id },
        data: { issueCounter: { increment: 1 } },
      })
      const created = await tx.issue.create({
        data: {
          projectId: ctx.project.id,
          sequenceId: counter.issueCounter,
          title: data.title,
          description: data.description ?? '',
          priority: data.priority ?? 'NONE',
          stateId: state.id,
          parentId: data.parentId ?? null,
          createdById: user.id,
          startDate: this.date(data.startDate),
          dueDate: this.date(data.dueDate),
          completedAt: state.group === 'COMPLETED' ? new Date() : null,
          sortOrder: Date.now(),
          estimate: data.estimate ?? null,
          isDraft: data.isDraft ?? false,
          assignees: {
            create: this.unique(data.assigneeIds ?? (ctx.project.defaultAssigneeId ? [ctx.project.defaultAssigneeId] : [])).map(
              (userId) => ({ userId }),
            ),
          },
          labels: { create: this.unique(data.labelIds ?? []).map((labelId) => ({ labelId })) },
          subscribers: { create: { userId: user.id } },
          ...(data.cycleId ? { cycleIssue: { create: { cycleId: data.cycleId } } } : {}),
          ...(data.moduleIds?.length
            ? { moduleIssues: { create: data.moduleIds.map((moduleId) => ({ moduleId })) } }
            : {}),
        },
      })
      await tx.activity.create({
        data: {
          workspaceId: ctx.workspace.id,
          projectId: ctx.project.id,
          issueId: created.id,
          actorId: user.id,
          action: 'created',
          newValue: data.title,
        },
      })
      return created
    })
    return { issue: await this.present(issue.id, ctx.project.identifier) }
  }

  async list(user: User, slug: string, projectId: string, query: Record<string, string | undefined>) {
    const ctx = await this.access.project(slug, projectId, user.id)
    const where: Prisma.IssueWhereInput = {
      projectId: ctx.project.id,
      archivedAt: query.archived === '1' ? { not: null } : null,
      isDraft: query.drafts === '1',
    }
    if (query.stateId) where.stateId = query.stateId
    if (query.priority && (PRIORITIES as readonly string[]).includes(query.priority)) {
      where.priority = query.priority as Priority
    }
    if (query.assigneeId) where.assignees = { some: { userId: query.assigneeId } }
    if (query.labelId) where.labels = { some: { labelId: query.labelId } }
    if (query.search) where.title = { contains: query.search, mode: 'insensitive' }
    const issues = await this.prisma.issue.findMany({
      where,
      include: this.listInclude(),
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      take: 500,
    })
    return { issues: issues.map((issue) => this.shape(issue, ctx.project.identifier)) }
  }

  async listWorkspace(user: User, slug: string, query: Record<string, string | undefined>) {
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
    const where: Prisma.IssueWhereInput = {
      projectId: { in: visible.map((project) => project.id) },
      archivedAt: null,
      isDraft: query.drafts === '1',
    }
    if (query.mine === '1') where.assignees = { some: { userId: user.id } }
    if (query.drafts === '1') where.createdById = user.id
    if (query.search) where.title = { contains: query.search, mode: 'insensitive' }
    const issues = await this.prisma.issue.findMany({
      where,
      include: { ...this.listInclude(), project: { select: { identifier: true, id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    })
    return {
      issues: issues.map((issue) => ({
        ...this.shape(issue, issue.project.identifier),
        projectId: issue.project.id,
        projectName: issue.project.name,
      })),
    }
  }

  async browse(user: User, slug: string, key: string) {
    const parsed = this.parseKey(key)
    const { workspace } = await this.access.workspace(slug, user.id)
    const project = await this.prisma.project.findUnique({
      where: { workspaceId_identifier: { workspaceId: workspace.id, identifier: parsed.identifier } },
    })
    if (!project) throw new NotFoundException('Work item not found')
    await this.access.project(slug, project.id, user.id)
    const issue = await this.prisma.issue.findUnique({
      where: { projectId_sequenceId: { projectId: project.id, sequenceId: parsed.sequenceId } },
    })
    if (!issue) throw new NotFoundException('Work item not found')
    await this.prisma.recentVisit.upsert({
      where: { userId_entityType_entityId: { userId: user.id, entityType: 'issue', entityId: issue.id } },
      update: { label: `${key} ${issue.title}`, href: `/${slug}/browse/${key}`, visitedAt: new Date() },
      create: {
        userId: user.id,
        workspaceId: workspace.id,
        entityType: 'issue',
        entityId: issue.id,
        label: `${key} ${issue.title}`,
        href: `/${slug}/browse/${key}`,
      },
    })
    return this.detail(issue.id, project.identifier, user.id)
  }

  async update(user: User, slug: string, projectId: string, issueId: string, body: unknown) {
    const data = parseBody(updateSchema, body)
    const ctx = await this.access.project(slug, projectId, user.id, true)
    const existing = await this.prisma.issue.findFirst({
      where: { id: issueId, projectId: ctx.project.id },
      include: { state: true },
    })
    if (!existing) throw new NotFoundException('Work item not found')
    const state = data.stateId ? await this.resolveState(this.prisma, ctx.project.id, data.stateId) : existing.state
    if (data.parentId !== undefined) await this.assertParent(this.prisma, ctx.project.id, existing.id, data.parentId)
    const completedAt =
      state.group === 'COMPLETED' ? existing.completedAt ?? new Date() : state.group === existing.state.group ? existing.completedAt : null
    const nextCompleted = state.id !== existing.stateId ? (state.group === 'COMPLETED' ? new Date() : null) : completedAt
    await this.prisma.$transaction(async (tx) => {
      await tx.issue.update({
        where: { id: existing.id },
        data: {
          title: data.title,
          description: data.description,
          priority: data.priority,
          stateId: state.id,
          parentId: data.parentId,
          startDate: data.startDate === undefined ? undefined : this.date(data.startDate),
          dueDate: data.dueDate === undefined ? undefined : this.date(data.dueDate),
          estimate: data.estimate,
          isDraft: data.isDraft,
          sortOrder: data.sortOrder,
          archivedAt: data.archived === undefined ? undefined : data.archived ? new Date() : null,
          completedAt: nextCompleted,
        },
      })
      const changes: Array<[string, string | null, string | null]> = []
      if (data.title && data.title !== existing.title) changes.push(['title', existing.title, data.title])
      if (data.priority && data.priority !== existing.priority) changes.push(['priority', existing.priority, data.priority])
      if (data.stateId && state.id !== existing.stateId) changes.push(['state', existing.state.name, state.name])
      if (data.description !== undefined && data.description !== existing.description) changes.push(['description', null, null])
      if (data.archived === true && !existing.archivedAt) changes.push(['archived', null, 'archived'])
      if (data.archived === false && existing.archivedAt) changes.push(['archived', 'archived', null])
      for (const [field, oldValue, newValue] of changes) {
        await tx.activity.create({
          data: {
            workspaceId: ctx.workspace.id,
            projectId: ctx.project.id,
            issueId: existing.id,
            actorId: user.id,
            action: 'updated',
            field,
            oldValue,
            newValue,
          },
        })
      }
    })
    return { issue: await this.present(existing.id, ctx.project.identifier) }
  }

  async setAssignees(user: User, slug: string, projectId: string, issueId: string, assigneeIds: string[]) {
    const ctx = await this.access.project(slug, projectId, user.id, true)
    const issue = await this.requireIssue(ctx.project.id, issueId)
    const ids = this.unique(assigneeIds)
    for (const id of ids) {
      const member = await this.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: ctx.workspace.id, userId: id } },
      })
      if (!member) throw new BadRequestException('Assignee is not in this workspace')
    }
    const previous = await this.prisma.issueAssignee.findMany({ where: { issueId }, include: { user: userBrief } })
    await this.prisma.$transaction(async (tx) => {
      await tx.issueAssignee.deleteMany({ where: { issueId } })
      if (ids.length) await tx.issueAssignee.createMany({ data: ids.map((userId) => ({ issueId, userId })) })
      await tx.activity.create({
        data: {
          workspaceId: ctx.workspace.id,
          projectId: ctx.project.id,
          issueId,
          actorId: user.id,
          action: 'updated',
          field: 'assignees',
          oldValue: previous.map((row) => row.user.displayName).join(', ') || null,
          newValue: ids.join(', ') || null,
        },
      })
    })
    return { issue: await this.present(issue.id, ctx.project.identifier) }
  }

  async setLabels(user: User, slug: string, projectId: string, issueId: string, labelIds: string[]) {
    const ctx = await this.access.project(slug, projectId, user.id, true)
    const issue = await this.requireIssue(ctx.project.id, issueId)
    const ids = this.unique(labelIds)
    const labels = await this.prisma.label.findMany({ where: { projectId: ctx.project.id, id: { in: ids } } })
    if (labels.length !== ids.length) throw new BadRequestException('Unknown label')
    await this.prisma.$transaction(async (tx) => {
      await tx.issueLabel.deleteMany({ where: { issueId } })
      if (ids.length) await tx.issueLabel.createMany({ data: ids.map((labelId) => ({ issueId, labelId })) })
      await tx.activity.create({
        data: {
          workspaceId: ctx.workspace.id,
          projectId: ctx.project.id,
          issueId,
          actorId: user.id,
          action: 'updated',
          field: 'labels',
          newValue: labels.map((label) => label.name).join(', '),
        },
      })
    })
    return { issue: await this.present(issue.id, ctx.project.identifier) }
  }

  async addRelation(user: User, slug: string, projectId: string, issueId: string, body: unknown) {
    const data = parseBody(relationSchema, body)
    const ctx = await this.access.project(slug, projectId, user.id, true)
    const issue = await this.requireIssue(ctx.project.id, issueId)
    const related = await this.issueByKey(ctx.workspace.id, data.relatedKey)
    if (!related) throw new NotFoundException('Related work item not found')
    if (related.id === issue.id) throw new BadRequestException('Choose a different work item')
    const relation = await this.prisma.issueRelation.create({
      data: { issueId: issue.id, relatedIssueId: related.id, type: data.type },
    })
    await this.prisma.activity.create({
      data: {
        workspaceId: ctx.workspace.id,
        projectId: ctx.project.id,
        issueId: issue.id,
        actorId: user.id,
        action: 'relation',
        field: data.type,
        newValue: data.relatedKey,
      },
    })
    return { relationId: relation.id, issue: await this.present(issue.id, ctx.project.identifier) }
  }

  async removeRelation(user: User, slug: string, projectId: string, relationId: string) {
    const ctx = await this.access.project(slug, projectId, user.id, true)
    const relation = await this.prisma.issueRelation.findFirst({
      where: { id: relationId, issue: { projectId: ctx.project.id } },
    })
    if (!relation) throw new NotFoundException('Relation not found')
    await this.prisma.issueRelation.delete({ where: { id: relation.id } })
    return { ok: true }
  }

  async addLink(user: User, slug: string, projectId: string, issueId: string, body: unknown) {
    const data = parseBody(linkSchema, body)
    const ctx = await this.access.project(slug, projectId, user.id, true)
    const issue = await this.requireIssue(ctx.project.id, issueId)
    const link = await this.prisma.issueLink.create({
      data: { issueId: issue.id, url: data.url, title: data.title, createdById: user.id },
    })
    await this.prisma.activity.create({
      data: {
        workspaceId: ctx.workspace.id,
        projectId: ctx.project.id,
        issueId: issue.id,
        actorId: user.id,
        action: 'link',
        newValue: data.title,
      },
    })
    return { link }
  }

  async removeLink(user: User, slug: string, projectId: string, linkId: string) {
    const ctx = await this.access.project(slug, projectId, user.id, true)
    const link = await this.prisma.issueLink.findFirst({ where: { id: linkId, issue: { projectId: ctx.project.id } } })
    if (!link) throw new NotFoundException('Link not found')
    await this.prisma.issueLink.delete({ where: { id: link.id } })
    return { ok: true }
  }

  async addAttachment(user: User, slug: string, projectId: string, issueId: string, body: unknown) {
    const data = parseBody(attachmentSchema, body)
    const ctx = await this.access.project(slug, projectId, user.id, true)
    const issue = await this.requireIssue(ctx.project.id, issueId)
    const bytes = Buffer.from(data.dataBase64, 'base64')
    if (!bytes.length || bytes.length > 2_000_000) throw new BadRequestException('Attachments must be between 1 byte and 2 MB')
    const storageKey = `${ctx.project.id}/${randomToken(12)}-${data.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const full = path.join(this.uploadDir(), storageKey)
    await mkdir(path.dirname(full), { recursive: true })
    await writeFile(full, bytes)
    const attachment = await this.prisma.attachment.create({
      data: {
        issueId: issue.id,
        filename: data.filename,
        mimeType: data.mimeType,
        size: bytes.length,
        storageKey,
        uploadedById: user.id,
      },
    })
    await this.prisma.activity.create({
      data: {
        workspaceId: ctx.workspace.id,
        projectId: ctx.project.id,
        issueId: issue.id,
        actorId: user.id,
        action: 'attachment',
        newValue: data.filename,
      },
    })
    return { attachment: { id: attachment.id, filename: attachment.filename, size: attachment.size, mimeType: attachment.mimeType } }
  }

  async downloadAttachment(user: User, slug: string, attachmentId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { issue: true },
    })
    if (!attachment) throw new NotFoundException('Attachment not found')
    await this.access.project(slug, attachment.issue.projectId, user.id)
    const bytes = await readFile(path.join(this.uploadDir(), attachment.storageKey))
    return new StreamableFile(bytes, {
      type: attachment.mimeType,
      disposition: `attachment; filename="${attachment.filename.replace(/"/g, '')}"`,
    })
  }

  async vote(user: User, slug: string, projectId: string, issueId: string, value: number) {
    const ctx = await this.access.project(slug, projectId, user.id)
    const issue = await this.requireIssue(ctx.project.id, issueId)
    if (value !== 1 && value !== -1) throw new BadRequestException('Vote must be 1 or -1')
    const existing = await this.prisma.issueVote.findUnique({
      where: { issueId_userId: { issueId, userId: user.id } },
    })
    if (existing?.value === value) {
      await this.prisma.issueVote.delete({ where: { issueId_userId: { issueId, userId: user.id } } })
    } else {
      await this.prisma.issueVote.upsert({
        where: { issueId_userId: { issueId, userId: user.id } },
        update: { value },
        create: { issueId, userId: user.id, value },
      })
    }
    return this.detail(issue.id, ctx.project.identifier, user.id)
  }

  async subscribe(user: User, slug: string, projectId: string, issueId: string, on: boolean) {
    const ctx = await this.access.project(slug, projectId, user.id)
    const issue = await this.requireIssue(ctx.project.id, issueId)
    if (on) {
      await this.prisma.issueSubscription.upsert({
        where: { issueId_userId: { issueId, userId: user.id } },
        update: {},
        create: { issueId, userId: user.id },
      })
    } else {
      await this.prisma.issueSubscription.deleteMany({ where: { issueId, userId: user.id } })
    }
    return this.detail(issue.id, ctx.project.identifier, user.id)
  }

  async createIntake(user: User, slug: string, projectId: string, body: unknown) {
    const data = parseBody(intakeSchema, body)
    const ctx = await this.access.project(slug, projectId, user.id)
    const item = await this.prisma.intakeItem.create({
      data: {
        projectId: ctx.project.id,
        title: data.title,
        description: data.description ?? '',
        createdById: user.id,
      },
    })
    return { intake: item }
  }

  async listIntake(user: User, slug: string, projectId: string, closed = false) {
    const ctx = await this.access.project(slug, projectId, user.id)
    const items = await this.prisma.intakeItem.findMany({
      where: {
        projectId: ctx.project.id,
        status: closed ? { in: ['ACCEPTED', 'DECLINED'] } : 'PENDING',
      },
      include: { createdBy: userBrief, issue: { select: { id: true, sequenceId: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return {
      intake: items.map((item) => ({
        ...item,
        key: item.issue ? `${ctx.project.identifier}-${item.issue.sequenceId}` : null,
      })),
    }
  }

  async acceptIntake(user: User, slug: string, projectId: string, intakeId: string) {
    const ctx = await this.access.project(slug, projectId, user.id, true)
    const item = await this.prisma.intakeItem.findFirst({ where: { id: intakeId, projectId: ctx.project.id } })
    if (!item) throw new NotFoundException('Intake item not found')
    if (item.status !== 'PENDING') throw new BadRequestException('This intake item is already closed')
    const created = await this.create(user, slug, projectId, { title: item.title, description: item.description })
    const issue = await this.prisma.issue.findFirstOrThrow({
      where: { projectId: ctx.project.id, sequenceId: Number(created.issue.key.split('-').pop()) },
    })
    await this.prisma.intakeItem.update({
      where: { id: item.id },
      data: { status: 'ACCEPTED', issueId: issue.id },
    })
    return { intakeId: item.id, issue: created.issue }
  }

  async declineIntake(user: User, slug: string, projectId: string, intakeId: string) {
    const ctx = await this.access.project(slug, projectId, user.id, true)
    const item = await this.prisma.intakeItem.findFirst({ where: { id: intakeId, projectId: ctx.project.id } })
    if (!item) throw new NotFoundException('Intake item not found')
    const updated = await this.prisma.intakeItem.update({ where: { id: item.id }, data: { status: 'DECLINED' } })
    return { intake: updated }
  }

  private async detail(issueId: string, identifier: string, userId: string) {
    const issue = await this.prisma.issue.findUniqueOrThrow({
      where: { id: issueId },
      include: {
        ...this.listInclude(),
        links: true,
        attachments: { select: { id: true, filename: true, mimeType: true, size: true, createdAt: true } },
        children: { include: this.listInclude(), orderBy: { sequenceId: 'asc' } },
        relations: { include: { relatedIssue: { include: { project: { select: { identifier: true } }, state: true } } } },
        relatedFrom: { include: { issue: { include: { project: { select: { identifier: true } }, state: true } } } },
        activities: { include: { actor: userBrief }, orderBy: { createdAt: 'desc' }, take: 50 },
        votes: true,
        subscribers: true,
      },
    })
    const up = issue.votes.filter((vote) => vote.value > 0).length
    const down = issue.votes.filter((vote) => vote.value < 0).length
    return {
      issue: {
        ...this.shape(issue, identifier),
        projectId: issue.projectId,
        description: issue.description,
        links: issue.links,
        attachments: issue.attachments,
        children: issue.children.map((child) => this.shape(child, identifier)),
        relations: [
          ...issue.relations.map((relation) => ({
            id: relation.id,
            type: relation.type,
            key: `${relation.relatedIssue.project.identifier}-${relation.relatedIssue.sequenceId}`,
            title: relation.relatedIssue.title,
            state: relation.relatedIssue.state,
          })),
          ...issue.relatedFrom.map((relation) => ({
            id: relation.id,
            type: relation.type,
            incoming: true,
            key: `${relation.issue.project.identifier}-${relation.issue.sequenceId}`,
            title: relation.issue.title,
            state: relation.issue.state,
          })),
        ],
        activity: issue.activities.map((row) => ({
          id: row.id,
          action: row.action,
          field: row.field,
          oldValue: row.oldValue,
          newValue: row.newValue,
          createdAt: row.createdAt,
          actor: row.actor,
        })),
        votes: { up, down, mine: issue.votes.find((vote) => vote.userId === userId)?.value ?? 0 },
        subscribed: issue.subscribers.some((row) => row.userId === userId),
      },
    }
  }

  private async present(issueId: string, identifier: string) {
    const issue = await this.prisma.issue.findUniqueOrThrow({ where: { id: issueId }, include: this.listInclude() })
    return this.shape(issue, identifier)
  }

  private listInclude() {
    return {
      state: true,
      createdBy: userBrief,
      assignees: { include: { user: userBrief } },
      labels: { include: { label: true } },
      parent: { select: { id: true, sequenceId: true, title: true } },
      children: { select: { id: true, state: { select: { group: true } } } },
      cycleIssue: { include: { cycle: { select: { id: true, name: true } } } },
      moduleIssues: { include: { module: { select: { id: true, name: true } } } },
      _count: { select: { links: true, relations: true, attachments: true } },
    } satisfies Prisma.IssueInclude
  }

  private shape(
    issue: {
      id: string
      sequenceId: number
      title: string
      priority: Priority
      startDate: Date | null
      dueDate: Date | null
      sortOrder: number
      estimate: string | null
      isDraft: boolean
      archivedAt: Date | null
      createdAt: Date
      updatedAt: Date
      state: { id: string; name: string; color: string; group: StateGroup }
      createdBy: { id: string; displayName: string; email: string; avatarColor: string }
      assignees: Array<{ user: { id: string; displayName: string; email: string; avatarColor: string } }>
      labels: Array<{ label: { id: string; name: string; color: string } }>
      parent: { id: string; sequenceId: number; title: string } | null
      children?: Array<{ id: string; state: { group: StateGroup } }>
      cycleIssue?: { cycle: { id: string; name: string } } | null
      moduleIssues?: Array<{ module: { id: string; name: string } }>
      _count?: { links: number; relations: number; attachments: number }
    },
    identifier: string,
  ) {
    const children = issue.children ?? []
    return {
      id: issue.id,
      key: `${identifier}-${issue.sequenceId}`,
      sequenceId: issue.sequenceId,
      title: issue.title,
      priority: issue.priority,
      state: issue.state,
      assignees: issue.assignees.map((row) => row.user),
      labels: issue.labels.map((row) => row.label),
      parent: issue.parent ? { ...issue.parent, key: `${identifier}-${issue.parent.sequenceId}` } : null,
      subIssueCount: children.length,
      subIssueDone: children.filter((child) => child.state.group === 'COMPLETED').length,
      linkCount: issue._count?.links ?? 0,
      relationCount: issue._count?.relations ?? 0,
      attachmentCount: issue._count?.attachments ?? 0,
      cycle: issue.cycleIssue?.cycle ?? null,
      modules: issue.moduleIssues?.map((row) => row.module) ?? [],
      startDate: issue.startDate,
      dueDate: issue.dueDate,
      sortOrder: issue.sortOrder,
      estimate: issue.estimate,
      isDraft: issue.isDraft,
      archivedAt: issue.archivedAt,
      createdBy: issue.createdBy,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
    }
  }

  private async resolveState(db: Db, projectId: string, stateId?: string) {
    const state = stateId
      ? await db.state.findFirst({ where: { id: stateId, projectId } })
      : await db.state.findFirst({ where: { projectId, isDefault: true } })
    if (!state) throw new BadRequestException('State not found')
    return state
  }

  private async assertParent(db: Db, projectId: string, issueId: string, parentId: string | null | undefined) {
    if (!parentId) return
    if (parentId === issueId) throw new BadRequestException('A work item cannot be its own parent')
    let current: string | null = parentId
    for (let depth = 0; depth < 20 && current; depth += 1) {
      const row: { id: string; parentId: string | null } | null = await db.issue.findFirst({
        where: { id: current, projectId },
        select: { id: true, parentId: true },
      })
      if (!row) throw new BadRequestException('Parent work item not found')
      if (row.id === issueId) throw new BadRequestException('That parent would create a cycle')
      current = row.parentId
    }
  }

  private async requireIssue(projectId: string, issueId: string) {
    const issue = await this.prisma.issue.findFirst({ where: { id: issueId, projectId } })
    if (!issue) throw new NotFoundException('Work item not found')
    return issue
  }

  private async issueByKey(workspaceId: string, key: string) {
    const parsed = this.parseKey(key)
    const project = await this.prisma.project.findUnique({
      where: { workspaceId_identifier: { workspaceId, identifier: parsed.identifier } },
    })
    if (!project) return null
    return this.prisma.issue.findUnique({
      where: { projectId_sequenceId: { projectId: project.id, sequenceId: parsed.sequenceId } },
    })
  }

  private parseKey(key: string) {
    const match = /^([A-Z][A-Z0-9]{1,5})-(\d+)$/.exec(key.toUpperCase())
    if (!match) throw new NotFoundException('Work item not found')
    return { identifier: match[1], sequenceId: Number(match[2]) }
  }

  private date(value: string | null | undefined) {
    if (value === undefined) return undefined
    if (value === null || value === '') return null
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Invalid date')
    return parsed
  }

  private unique(values: string[]) {
    return [...new Set(values)]
  }

  private uploadDir() {
    return process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')
  }
}
