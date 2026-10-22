import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { Project, ProjectMember, Workspace, WorkspaceMember } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

export type WorkspaceContext = {
  workspace: Workspace
  membership: WorkspaceMember
}

export type ProjectContext = WorkspaceContext & {
  project: Project
  projectMember: ProjectMember | null
  canWrite: boolean
}

@Injectable()
export class AccessService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async workspace(slug: string, userId: string): Promise<WorkspaceContext> {
    const workspace = await this.prisma.workspace.findUnique({ where: { slug } })
    if (!workspace) throw new NotFoundException('Workspace not found')
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId } },
    })
    if (!membership) throw new ForbiddenException('You are not a member of this workspace')
    return { workspace, membership }
  }

  isAdmin(membership: { role: string; isOwner: boolean }) {
    return membership.isOwner || membership.role === 'ADMIN'
  }

  canWrite(membership: WorkspaceMember, project: Project, projectMember: ProjectMember | null) {
    if (membership.role === 'GUEST') return false
    if (this.isAdmin(membership)) return true
    if (projectMember?.role === 'GUEST') return false
    if (project.network === 'PRIVATE') return Boolean(projectMember)
    return true
  }

  async project(slug: string, projectId: string, userId: string, write = false): Promise<ProjectContext> {
    const ctx = await this.workspace(slug, userId)
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId: ctx.workspace.id },
    })
    if (!project) throw new NotFoundException('Project not found')
    const projectMember = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    })
    this.assertVisible(ctx.membership, project, projectMember)
    const canWrite = this.canWrite(ctx.membership, project, projectMember)
    if (write && !canWrite) throw new ForbiddenException('You cannot change work in this project')
    return { ...ctx, project, projectMember, canWrite }
  }

  assertVisible(membership: WorkspaceMember, project: Project, projectMember: ProjectMember | null) {
    if (membership.role === 'GUEST' && !projectMember) {
      throw new ForbiddenException('Guests only see projects they belong to')
    }
    if (project.network === 'PRIVATE' && !projectMember && !this.isAdmin(membership)) {
      throw new ForbiddenException('This project is private')
    }
  }
}
