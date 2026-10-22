import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { User } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import type { Response } from 'express'
import * as jwt from 'jsonwebtoken'
import { z } from 'zod'
import { parseBody } from '../common/zod'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'
import { setAuthCookies, clearAuthCookies } from './cookies'
import { accessSecret, colorFor, randomToken, refreshSecret, sha256 } from './token.util'

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  displayName: z.string().trim().min(1).max(80),
})

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
})

const REFRESH_MS = 30 * 24 * 60 * 60 * 1000

export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarColor: user.avatarColor,
    createdAt: user.createdAt,
  }
}

@Injectable()
export class AuthService {
  private readonly dummyHash = bcrypt.hashSync('ordr-dummy-password', 8)

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  async signup(body: unknown, res: Response, userAgent?: string) {
    const data = parseBody(signupSchema, body)
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } })
    if (existing) throw new ConflictException('An account with that email already exists')
    const passwordHash = await bcrypt.hash(data.password, 10)
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        displayName: data.displayName,
        avatarColor: colorFor(data.email),
      },
    })
    await this.createSession(user, res, userAgent)
    return { user: publicUser(user) }
  }

  async login(body: unknown, res: Response, userAgent?: string) {
    const data = parseBody(loginSchema, body)
    const attempts = await this.redis.hit(`login:${data.email}`, 15 * 60)
    if (attempts > 30) {
      throw new UnauthorizedException('Too many login attempts. Try again later.')
    }
    const user = await this.prisma.user.findUnique({ where: { email: data.email } })
    const hash = user?.passwordHash ?? this.dummyHash
    const matches = await bcrypt.compare(data.password, hash)
    if (!user || !matches) throw new UnauthorizedException('Email or password is incorrect')
    await this.createSession(user, res, userAgent)
    return { user: publicUser(user) }
  }

  async refresh(token: string | undefined, res: Response) {
    if (!token) throw new UnauthorizedException()
    let payload: { sub?: string; sid?: string; type?: string }
    try {
      payload = jwt.verify(token, refreshSecret()) as typeof payload
    } catch {
      throw new UnauthorizedException()
    }
    if (payload.type !== 'refresh' || !payload.sid || !payload.sub) throw new UnauthorizedException()
    const session = await this.prisma.session.findUnique({ where: { id: payload.sid } })
    if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException()
    }
    if (session.userId !== payload.sub || session.refreshTokenHash !== sha256(token)) {
      throw new UnauthorizedException()
    }
    const user = await this.prisma.user.findUnique({ where: { id: session.userId } })
    if (!user) throw new UnauthorizedException()
    const refresh = jwt.sign(
      { sub: user.id, sid: session.id, type: 'refresh' },
      refreshSecret(),
      { expiresIn: '30d' },
    )
    const access = jwt.sign(
      { sub: user.id, sid: session.id, type: 'access' },
      accessSecret(),
      { expiresIn: '15m' },
    )
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: sha256(refresh),
        expiresAt: new Date(Date.now() + REFRESH_MS),
      },
    })
    setAuthCookies(res, access, refresh)
    return { user: publicUser(user) }
  }

  async logout(token: string | undefined, res: Response) {
    if (token) {
      try {
        const payload = jwt.verify(token, refreshSecret()) as { sid?: string }
        if (payload.sid) {
          await this.prisma.session
            .update({ where: { id: payload.sid }, data: { revokedAt: new Date() } })
            .catch(() => undefined)
        }
      } catch {
        /* clear cookies even when the refresh token is already expired */
      }
    }
    clearAuthCookies(res)
    return { ok: true }
  }

  me(user: User) {
    return { user: publicUser(user) }
  }

  private async createSession(user: User, res: Response, userAgent?: string) {
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: `pending:${randomToken(16)}`,
        expiresAt: new Date(Date.now() + REFRESH_MS),
        userAgent,
      },
    })
    const refresh = jwt.sign(
      { sub: user.id, sid: session.id, type: 'refresh' },
      refreshSecret(),
      { expiresIn: '30d' },
    )
    const access = jwt.sign(
      { sub: user.id, sid: session.id, type: 'access' },
      accessSecret(),
      { expiresIn: '15m' },
    )
    await this.prisma.session.update({
      where: { id: session.id },
      data: { refreshTokenHash: sha256(refresh) },
    })
    setAuthCookies(res, access, refresh)
  }
}
