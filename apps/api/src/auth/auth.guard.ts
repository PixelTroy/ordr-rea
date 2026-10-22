import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { User } from '@prisma/client'
import * as jwt from 'jsonwebtoken'
import { PrismaService } from '../prisma/prisma.service'
import { IS_PUBLIC } from './public.decorator'
import { accessSecret } from './token.util'

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
    const token = header?.startsWith('Bearer ')
      ? header.slice('Bearer '.length)
      : request.cookies?.ordr_access
    if (!token) throw new UnauthorizedException()

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
}
