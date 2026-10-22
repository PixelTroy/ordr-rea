import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { User } from '@prisma/client'
import * as jwt from 'jsonwebtoken'
import { PrismaService } from '../prisma/prisma.service'
import { IS_PUBLIC } from './public.decorator'
import { accessSecret, sha256 } from './token.util'

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true
    if (context.getType() !== 'http') return true

    const request = context.switchToHttp().getRequest()
    const header = request.headers?.authorization as string | undefined
    const bearer = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : undefined
    const token = bearer || request.cookies?.ordr_access
    if (!token) throw new UnauthorizedException()

    if (bearer?.startsWith('ordr_')) {
      const apiUser = await this.userFromApiToken(bearer, request.params?.slug)
      if (!apiUser) throw new UnauthorizedException()
      request.user = apiUser
      return true
    }

    try {
      const payload = jwt.verify(token, accessSecret()) as { sub?: string; sid?: string; type?: string }
      if (payload.type !== 'access' || !payload.sub || !payload.sid) throw new Error('invalid access token')
      const session = await this.prisma.session.findUnique({ where: { id: payload.sid } })
      if (!session || session.revokedAt || session.userId !== payload.sub) throw new Error('revoked session')
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } })
      if (!user) throw new Error('missing user')
      request.user = user as User
      return true
    } catch {
      throw new UnauthorizedException()
    }
  }

  private async userFromApiToken(token: string, slug?: string): Promise<User | null> {
    const row = await this.prisma.apiToken.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: true, workspace: { select: { slug: true } } },
    })
    if (!row || (row.expiresAt && row.expiresAt.getTime() <= Date.now())) return null
    if (slug && row.workspace.slug !== slug) return null
    await this.prisma.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined)
    return row.user
  }
}
