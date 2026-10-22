import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { User, WorkspaceMember, WorkspaceRole } from '@prisma/client'
import { isReservedSlug, SLUG_PATTERN, WORKSPACE_ROLES } from '@ordr/shared'
import { z } from 'zod'
import { parseBody } from '../common/zod'
import { PrismaService } from '../prisma/prisma.service'
import { appUrl, randomToken } from '../auth/token.util'

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(48)
  .regex(SLUG_PATTERN, 'Use lowercase letters, numbers, and hyphens')
  .refine((slug) => !isReservedSlug(slug), 'This URL is reserved')

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: slugSchema,
  companySize: z.string().trim().max(40).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
})

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    slug: slugSchema.optional(),
    description: z.string().max(500).optional(),
    companySize: z.string().trim().max(40).optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'No changes submitted')

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(WORKSPACE_ROLES).default('MEMBER'),
})

const roleSchema = z.object({
  role: z.enum(WORKSPACE_ROLES),
})

const deleteSchema = z.object({
  confirmSlug: z.string(),
})

const INVITE_MS = 7 * 24 * 60 * 60 * 1000

function publicWorkspace(workspace: {
  id: string
  name: string
  slug: string
  description: string
  companySize: string
  timezone: string
  logoUrl: string | null
  ownerId: string
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    description: workspace.description,
    companySize: workspace.companySize,
    timezone: workspace.timezone,
    logoUrl: workspace.logoUrl,
    ownerId: workspace.ownerId,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  }
}

function publicMember(member: WorkspaceMember & { user: User }) {
  return {
    id: member.id,
    role: member.role,
    isOwner: member.isOwner,
    joinedAt: member.createdAt,
    user: {
      id: member.user.id,
      email: member.user.email,
      displayName: member.user.displayName,
      avatarColor: member.user.avatarColor,
    },
  }
}

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name)

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(user: User, body: unknown) {
    const data = parseBody(createSchema, body)
    const taken = await this.prisma.workspace.findUnique({ where: { slug: data.slug } })
    if (taken) throw new ConflictException('That workspace URL is already taken')
    const workspace = await this.prisma.workspace.create({
      data: {
        name: data.name,
        slug: data.slug,
        companySize: data.companySize ?? '',
        timezone: data.timezone ?? 'UTC',
        ownerId: user.id,
        members: {
          create: { userId: user.id, role: 'ADMIN', isOwner: true },
        },
      },
    })
    return {
      workspace: publicWorkspace(workspace),
      membership: { role: 'ADMIN' as WorkspaceRole, isOwner: true },
    }
  }

  async list(user: User) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId: user.id },
      include: { workspace: true },
      orderBy: { createdAt: 'asc' },
    })
    return {
      workspaces: memberships.map((membership) => ({
        ...publicWorkspace(membership.workspace),
        role: membership.role,
        isOwner: membership.isOwner,
      })),
    }
  }

  async get(user: User, slug: string) {
    const { workspace, membership } = await this.requireMember(slug, user.id)
    return { workspace: publicWorkspace(workspace), membership: this.membershipView(membership) }
  }

  async update(user: User, slug: string, body: unknown) {
    const data = parseBody(updateSchema, body)
    const { workspace, membership } = await this.requireMember(slug, user.id)
    this.assertAdmin(membership)
    if (data.slug && data.slug !== workspace.slug) {
      const taken = await this.prisma.workspace.findUnique({ where: { slug: data.slug } })
      if (taken) throw new ConflictException('That workspace URL is already taken')
    }
    const updated = await this.prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        companySize: data.companySize,
        timezone: data.timezone,
      },
    })
    return { workspace: publicWorkspace(updated), membership: this.membershipView(membership) }
  }

  async remove(user: User, slug: string, body: unknown) {
    const data = parseBody(deleteSchema, body)
    const { workspace, membership } = await this.requireMember(slug, user.id)
    if (!membership.isOwner) throw new ForbiddenException('Only the workspace owner can delete it')
    if (data.confirmSlug !== workspace.slug) {
      throw new BadRequestException('Type the workspace URL to confirm deletion')
    }
    await this.prisma.workspace.delete({ where: { id: workspace.id } })
    return { ok: true }
  }

  async members(user: User, slug: string) {
    const { workspace } = await this.requireMember(slug, user.id)
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    })
    members.sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || a.user.displayName.localeCompare(b.user.displayName))
    return { members: members.map(publicMember) }
  }

  async updateMember(user: User, slug: string, memberUserId: string, body: unknown) {
    const data = parseBody(roleSchema, body)
    const { workspace, membership } = await this.requireMember(slug, user.id)
    this.assertAdmin(membership)
    if (memberUserId === user.id) throw new ForbiddenException('You cannot change your own role')
    const target = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: memberUserId } },
    })
    if (!target) throw new NotFoundException('Member not found')
    if (target.isOwner) throw new ForbiddenException('The owner role cannot be changed')
    const updated = await this.prisma.workspaceMember.update({
      where: { id: target.id },
      data: { role: data.role },
      include: { user: true },
    })
    return { member: publicMember(updated) }
  }

  async removeMember(user: User, slug: string, memberUserId: string) {
    const { workspace, membership } = await this.requireMember(slug, user.id)
    const target = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: memberUserId } },
    })
    if (!target) throw new NotFoundException('Member not found')
    if (target.isOwner) throw new ForbiddenException('The owner cannot be removed')
    if (target.userId !== user.id) this.assertAdmin(membership)
    await this.prisma.workspaceMember.delete({ where: { id: target.id } })
    return { ok: true }
  }

  async createInvite(user: User, slug: string, body: unknown) {
    const data = parseBody(inviteSchema, body)
    const { workspace, membership } = await this.requireMember(slug, user.id)
    this.assertAdmin(membership)
    const existingMember = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId: workspace.id, user: { email: data.email } },
    })
    if (existingMember) throw new ConflictException('That person is already a member')
    const token = randomToken(32)
    const expiresAt = new Date(Date.now() + INVITE_MS)
    const pending = await this.prisma.workspaceInvite.findFirst({
      where: { workspaceId: workspace.id, email: data.email, acceptedAt: null },
    })
    const invite = pending
      ? await this.prisma.workspaceInvite.update({
          where: { id: pending.id },
          data: { token, role: data.role, expiresAt, invitedById: user.id },
        })
      : await this.prisma.workspaceInvite.create({
          data: {
            workspaceId: workspace.id,
            email: data.email,
            role: data.role,
            token,
            invitedById: user.id,
            expiresAt,
          },
        })
    const acceptUrl = `${appUrl()}/invite/${invite.token}`
    this.logger.log(`Workspace invite for ${invite.email} to ${workspace.slug}: ${acceptUrl}`)
    return { invite: this.inviteView(invite), acceptUrl }
  }

  async listInvites(user: User, slug: string) {
    const { workspace, membership } = await this.requireMember(slug, user.id)
    this.assertAdmin(membership)
    const invites = await this.prisma.workspaceInvite.findMany({
      where: { workspaceId: workspace.id, acceptedAt: null },
      orderBy: { createdAt: 'desc' },
    })
    return {
      invites: invites.map((invite) => ({
        ...this.inviteView(invite),
        acceptUrl: `${appUrl()}/invite/${invite.token}`,
        expired: invite.expiresAt.getTime() < Date.now(),
      })),
    }
  }

  async revokeInvite(user: User, slug: string, inviteId: string) {
    const { workspace, membership } = await this.requireMember(slug, user.id)
    this.assertAdmin(membership)
    const invite = await this.prisma.workspaceInvite.findFirst({
      where: { id: inviteId, workspaceId: workspace.id },
    })
    if (!invite) throw new NotFoundException('Invite not found')
    await this.prisma.workspaceInvite.delete({ where: { id: invite.id } })
    return { ok: true }
  }

  async previewInvite(token: string) {
    const invite = await this.prisma.workspaceInvite.findUnique({
      where: { token },
      include: { workspace: true },
    })
    if (!invite) throw new NotFoundException('Invite not found')
    return {
      email: invite.email,
      role: invite.role,
      workspaceName: invite.workspace.name,
      workspaceSlug: invite.workspace.slug,
      expiresAt: invite.expiresAt,
      accepted: Boolean(invite.acceptedAt),
      expired: invite.expiresAt.getTime() < Date.now(),
    }
  }

  async acceptInvite(user: User, token: string) {
    const invite = await this.prisma.workspaceInvite.findUnique({
      where: { token },
      include: { workspace: true },
    })
    if (!invite) throw new NotFoundException('Invite not found')
    if (invite.acceptedAt) throw new BadRequestException('This invite has already been accepted')
    if (invite.expiresAt.getTime() < Date.now()) throw new BadRequestException('This invite has expired')
    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new ForbiddenException(`This invite was sent to ${invite.email}`)
    }
    const existing = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: user.id } },
    })
    if (!existing) {
      await this.prisma.workspaceMember.create({
        data: {
          workspaceId: invite.workspaceId,
          userId: user.id,
          role: invite.role,
          isOwner: false,
        },
      })
    }
    await this.prisma.workspaceInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    })
    return {
      workspace: publicWorkspace(invite.workspace),
      alreadyMember: Boolean(existing),
    }
  }

  private membershipView(membership: WorkspaceMember) {
    return { role: membership.role, isOwner: membership.isOwner }
  }

  private inviteView(invite: {
    id: string
    email: string
    role: WorkspaceRole
    expiresAt: Date
    acceptedAt: Date | null
    createdAt: Date
  }) {
    return {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      acceptedAt: invite.acceptedAt,
      createdAt: invite.createdAt,
    }
  }

  private assertAdmin(membership: WorkspaceMember) {
    if (membership.isOwner || membership.role === 'ADMIN') return
    throw new ForbiddenException('Admin access required')
  }

  private async requireMember(slug: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({ where: { slug } })
    if (!workspace) throw new NotFoundException('Workspace not found')
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId } },
    })
    if (!membership) throw new ForbiddenException('You are not a member of this workspace')
    return { workspace, membership }
  }
}
