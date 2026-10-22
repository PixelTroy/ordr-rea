import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { PageAccess, Prisma, User } from '@prisma/client'
import * as Y from 'yjs'
import { z } from 'zod'
import { AccessService } from '../access/access.service'
import { parseBody } from '../common/zod'
import { PrismaService } from '../prisma/prisma.service'
import { asJson, mentionIds, NotificationsService, plainText } from './notifications.service'

const pageSchema = z.object({
  title: z.string().trim().min(1).max(200),
  projectId: z.string().nullable().optional(),
  access: z.enum(['PUBLIC', 'PRIVATE']).optional(),
  contentJson: z.unknown().optional(),
})

const pagePatch = pageSchema.partial().extend({
  archived: z.boolean().optional(),
})

const commentSchema = z.object({
  bodyJson: z.unknown(),
})

@Injectable()
export class PagesService {
  private readonly docs = new Map<string, Y.Doc>()

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(NotificationsService) private readonly notes: NotificationsService,
  ) {}

  async create(user: User, slug: string, body: unknown) {
    const data = parseBody(pageSchema, body)
    const { workspace, membership } = await this.access.workspace(slug, user.id)
    if (membership.role === 'GUEST') throw new ForbiddenException('Guests cannot create pages')
    if (data.projectId) await this.access.project(slug, data.projectId, user.id, true)
    const page = await this.prisma.page.create({
      data: {
        workspaceId: workspace.id,
        projectId: data.projectId ?? null,
        title: data.title,
        access: (data.access as PageAccess | undefined) ?? 'PUBLIC',
        contentJson: data.contentJson ? asJson(data.contentJson) : {},
        createdById: user.id,
        updatedById: user.id,
      },
      include: this.include(user.id),
    })
    return { page: this.present(page) }
  }

  async list(user: User, slug: string, query: Record<string, string | undefined>) {
    const { workspace, membership } = await this.access.workspace(slug, user.id)
    const where: Prisma.PageWhereInput = {
      workspaceId: workspace.id,
      archivedAt: query.archived === '1' ? { not: null } : null,
      projectId: query.wiki === '1' ? null : query.projectId || undefined,
    }
    if (query.access === 'PUBLIC' || query.access === 'PRIVATE') where.access = query.access
    const pages = await this.prisma.page.findMany({
      where,
      include: this.include(user.id),
      orderBy: { updatedAt: 'desc' },
      take: 200,
    })
    const visible = pages.filter((page) => this.visible(page, user.id, membership.role === 'ADMIN' || membership.isOwner))
    return { pages: visible.map((page) => this.present(page)) }
  }

  async get(user: User, slug: string, pageId: string) {
    const page = await this.load(user, slug, pageId, false)
    return { page: this.present(page) }
  }

  async update(user: User, slug: string, pageId: string, body: unknown) {
    const data = parseBody(pagePatch, body)
    const existing = await this.load(user, slug, pageId, true)
    const page = await this.prisma.page.update({
      where: { id: existing.id },
      data: {
        title: data.title,
        access: data.access as PageAccess | undefined,
        contentJson: data.contentJson === undefined ? undefined : asJson(data.contentJson),
        updatedById: user.id,
        archivedAt: data.archived === undefined ? undefined : data.archived ? new Date() : null,
      },
      include: this.include(user.id),
    })
    if (data.contentJson) {
      const href = existing.projectId
        ? `/${slug}/projects/${existing.projectId}/pages/${existing.id}`
        : `/${slug}/wiki/${existing.id}`
      for (const mentioned of mentionIds(data.contentJson)) {
        await this.notes.notify({
          userId: mentioned,
          workspaceId: existing.workspaceId,
          actorId: user.id,
          type: 'mention',
          title: `${user.displayName} mentioned you in ${existing.title}`,
          body: plainText(data.contentJson).slice(0, 180),
          href,
        })
      }
    }
    return { page: this.present(page) }
  }

  async remove(user: User, slug: string, pageId: string) {
    const page = await this.load(user, slug, pageId, true)
    await this.prisma.page.delete({ where: { id: page.id } })
    this.docs.delete(page.id)
    return { ok: true }
  }

  async favorite(user: User, slug: string, pageId: string, on: boolean) {
    const page = await this.load(user, slug, pageId, false)
    if (on) {
      await this.prisma.pageFavorite.upsert({
        where: { pageId_userId: { pageId: page.id, userId: user.id } },
        update: {},
        create: { pageId: page.id, userId: user.id },
      })
    } else {
      await this.prisma.pageFavorite.deleteMany({ where: { pageId: page.id, userId: user.id } })
    }
    return this.get(user, slug, page.id)
  }

  async state(userId: string, pageId: string) {
    await this.assertSocket(userId, pageId)
    const doc = await this.docFor(pageId)
    return Buffer.from(Y.encodeStateAsUpdate(doc))
  }

  async applyUpdate(userId: string, pageId: string, update: Uint8Array) {
    await this.assertSocket(userId, pageId)
    const doc = await this.docFor(pageId)
    Y.applyUpdate(doc, update)
    const state = Buffer.from(Y.encodeStateAsUpdate(doc))
    await this.prisma.page.update({
      where: { id: pageId },
      data: { yjsState: state, updatedById: userId },
    })
    return state
  }

  async listComments(user: User, slug: string, projectId: string, issueId: string) {
    const ctx = await this.access.project(slug, projectId, user.id)
    await this.requireIssue(ctx.project.id, issueId)
    const comments = await this.prisma.comment.findMany({
      where: { issueId },
      include: {
        author: { select: { id: true, displayName: true, avatarColor: true } },
        reactions: true,
      },
      orderBy: { createdAt: 'asc' },
    })
    return { comments }
  }

  async addComment(user: User, slug: string, projectId: string, issueId: string, body: unknown) {
    const data = parseBody(commentSchema, body)
    const ctx = await this.access.project(slug, projectId, user.id, true)
    const issue = await this.requireIssue(ctx.project.id, issueId)
    const text = plainText(data.bodyJson).trim()
    if (!text) throw new BadRequestException('Write a comment first')
    const comment = await this.prisma.comment.create({
      data: { issueId, authorId: user.id, bodyJson: asJson(data.bodyJson), bodyText: text },
      include: { author: { select: { id: true, displayName: true, avatarColor: true } }, reactions: true },
    })
    const href = `/${slug}/browse/${ctx.project.identifier}-${issue.sequenceId}`
    const subscribers = await this.prisma.issueSubscription.findMany({ where: { issueId } })
    for (const subscriber of subscribers) {
      await this.notes.notify({
        userId: subscriber.userId,
        workspaceId: ctx.workspace.id,
        actorId: user.id,
        type: 'comment',
        title: `${user.displayName} commented on ${ctx.project.identifier}-${issue.sequenceId}`,
        body: text.slice(0, 180),
        href,
      })
    }
    for (const mentioned of mentionIds(data.bodyJson)) {
      await this.notes.notify({
        userId: mentioned,
        workspaceId: ctx.workspace.id,
        actorId: user.id,
        type: 'mention',
        title: `${user.displayName} mentioned you on ${ctx.project.identifier}-${issue.sequenceId}`,
        body: text.slice(0, 180),
        href,
      })
    }
    await this.prisma.activity.create({
      data: {
        workspaceId: ctx.workspace.id,
        projectId: ctx.project.id,
        issueId,
        actorId: user.id,
        action: 'comment',
        newValue: text.slice(0, 180),
      },
    })
    return { comment }
  }

  async react(user: User, slug: string, commentId: string, emoji: string) {
    const { workspace } = await this.access.workspace(slug, user.id)
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, issue: { project: { workspaceId: workspace.id } } },
    })
    if (!comment) throw new NotFoundException('Comment not found')
    const existing = await this.prisma.commentReaction.findUnique({
      where: { commentId_userId_emoji: { commentId, userId: user.id, emoji } },
    })
    if (existing) {
      await this.prisma.commentReaction.delete({
        where: { commentId_userId_emoji: { commentId, userId: user.id, emoji } },
      })
    } else {
      await this.prisma.commentReaction.create({ data: { commentId, userId: user.id, emoji } })
    }
    return { ok: true }
  }

  private async docFor(pageId: string) {
    const cached = this.docs.get(pageId)
    if (cached) return cached
    const page = await this.prisma.page.findUnique({ where: { id: pageId } })
    if (!page) throw new NotFoundException('Page not found')
    const doc = new Y.Doc()
    if (page.yjsState) Y.applyUpdate(doc, new Uint8Array(page.yjsState))
    this.docs.set(pageId, doc)
    return doc
  }

  private async assertSocket(userId: string, pageId: string) {
    const page = await this.prisma.page.findUnique({
      where: { id: pageId },
      include: { workspace: true, project: true },
    })
    if (!page) throw new NotFoundException('Page not found')
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: page.workspaceId, userId } },
    })
    if (!membership) throw new ForbiddenException('You cannot open this page')
    const admin = membership.role === 'ADMIN' || membership.isOwner
    if (page.access === 'PRIVATE' && page.createdById !== userId && !admin) {
      throw new ForbiddenException('This page is private')
    }
    if (page.projectId && page.project) {
      if (membership.role === 'GUEST') {
        const joined = await this.prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId: page.projectId, userId } },
        })
        if (!joined) throw new ForbiddenException('You cannot open this page')
      } else if (page.project.network === 'PRIVATE' && !admin) {
        const joined = await this.prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId: page.projectId, userId } },
        })
        if (!joined) throw new ForbiddenException('You cannot open this page')
      }
    }
  }

  private async load(user: User, slug: string, pageId: string, write: boolean) {
    const { workspace, membership } = await this.access.workspace(slug, user.id)
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, workspaceId: workspace.id },
      include: this.include(user.id),
    })
    if (!page) throw new NotFoundException('Page not found')
    const admin = membership.role === 'ADMIN' || membership.isOwner
    if (!this.visible(page, user.id, admin)) throw new ForbiddenException('This page is private')
    if (page.projectId) await this.access.project(slug, page.projectId, user.id, write)
    else if (write && membership.role === 'GUEST') throw new ForbiddenException('Guests cannot edit pages')
    if (write && page.access === 'PRIVATE' && page.createdById !== user.id && !admin) {
      throw new ForbiddenException('This page is private')
    }
    return page
  }

  private visible(page: { access: PageAccess; createdById: string }, userId: string, admin: boolean) {
    if (page.access === 'PUBLIC') return true
    return page.createdById === userId || admin
  }

  private include(userId: string) {
    return {
      createdBy: { select: { id: true, displayName: true, avatarColor: true } },
      favorites: { where: { userId }, select: { userId: true } },
      project: { select: { id: true, name: true, identifier: true } },
    } satisfies Prisma.PageInclude
  }

  private present(page: {
    id: string
    title: string
    access: PageAccess
    contentJson: Prisma.JsonValue
    projectId: string | null
    archivedAt: Date | null
    createdAt: Date
    updatedAt: Date
    createdBy: { id: string; displayName: string; avatarColor: string }
    favorites: Array<{ userId: string }>
    project: { id: string; name: string; identifier: string } | null
  }) {
    return {
      id: page.id,
      title: page.title,
      access: page.access,
      contentJson: page.contentJson,
      projectId: page.projectId,
      project: page.project,
      archivedAt: page.archivedAt,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
      createdBy: page.createdBy,
      favorite: page.favorites.length > 0,
    }
  }

  private async requireIssue(projectId: string, issueId: string) {
    const issue = await this.prisma.issue.findFirst({ where: { id: issueId, projectId } })
    if (!issue) throw new NotFoundException('Work item not found')
    return issue
  }
}
