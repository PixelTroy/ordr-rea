import { Inject, Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

export type NoteInput = {
  userId: string
  workspaceId: string
  actorId?: string | null
  type: 'mention' | 'assignment' | 'comment'
  title: string
  body?: string
  href: string
}

@Injectable()
export class NotificationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async notify(input: NoteInput) {
    if (!input.userId || input.userId === input.actorId) return
    await this.prisma.notification.create({
      data: {
        userId: input.userId,
        workspaceId: input.workspaceId,
        actorId: input.actorId ?? null,
        type: input.type,
        title: input.title,
        body: input.body ?? '',
        href: input.href,
      },
    })
  }

  async list(userId: string, workspaceId: string, mentions: boolean) {
    const rows = await this.prisma.notification.findMany({
      where: { userId, workspaceId, ...(mentions ? { type: 'mention' } : {}) },
      include: { actor: { select: { id: true, displayName: true, avatarColor: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return { notifications: rows, unread: rows.filter((row) => !row.readAt).length }
  }

  async markRead(userId: string, ids: string[]) {
    await this.prisma.notification.updateMany({
      where: { userId, id: { in: ids }, readAt: null },
      data: { readAt: new Date() },
    })
    return { ok: true }
  }

  async markAll(userId: string, workspaceId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, workspaceId, readAt: null },
      data: { readAt: new Date() },
    })
    return { ok: true }
  }
}

export function plainText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const record = node as { type?: string; text?: string; attrs?: { label?: string }; content?: unknown[] }
  if (record.type === 'text') return record.text || ''
  if (record.type === 'mention') return `@${record.attrs?.label || 'someone'}`
  const children = (record.content || []).map((child) => plainText(child)).join('')
  if (record.type === 'paragraph' || record.type === 'heading') return `${children}\n`
  return children
}

export function mentionIds(node: unknown, found: string[] = []): string[] {
  if (!node || typeof node !== 'object') return found
  const record = node as { type?: string; attrs?: { id?: string }; content?: unknown[] }
  if (record.type === 'mention' && record.attrs?.id) found.push(record.attrs.id)
  for (const child of record.content || []) mentionIds(child, found)
  return [...new Set(found)]
}

export function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}
