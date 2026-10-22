import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { PrismaService } from '../src/prisma/prisma.service'
import { cookieHeader, createTestApp, resetDatabase, signup } from './app'

describe('auth', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    const created = await createTestApp()
    app = created.app
    prisma = created.prisma
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(async () => {
    await resetDatabase(prisma)
  })

  it('reports health', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('signs up, reads the session, refreshes, and logs out', async () => {
    const { res, email, cookies } = await signup(app, {
      email: 'ada@example.com',
      displayName: 'Ada Lovelace',
    })
    expect(res.status).toBe(201)
    expect(res.body.user.email).toBe(email)
    expect(cookies).toContain('ordr_access=')
    expect(cookies).toContain('ordr_refresh=')

    const me = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', cookies)
    expect(me.status).toBe(200)
    expect(me.body.user.displayName).toBe('Ada Lovelace')

    const refreshCookie = cookies
      .split('; ')
      .filter((part) => part.startsWith('ordr_refresh='))
      .join('; ')
    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie)
    expect(refreshed.status).toBe(201)
    const nextCookies = cookieHeader(refreshed)
    const meAgain = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', nextCookies)
    expect(meAgain.status).toBe(200)

    const loggedOut = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', nextCookies)
    expect(loggedOut.status).toBe(201)
    const after = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', nextCookies)
    expect(after.status).toBe(401)
  })

  it('rejects duplicate emails, weak passwords, and bad credentials', async () => {
    await signup(app, { email: 'ada@example.com' })
    const duplicate = await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      email: 'ada@example.com',
      password: 'password123',
      displayName: 'Ada',
    })
    expect(duplicate.status).toBe(409)

    const weak = await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      email: 'weak@example.com',
      password: 'short',
      displayName: 'Weak',
    })
    expect(weak.status).toBe(400)

    const bad = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'ada@example.com',
      password: 'not-the-password',
    })
    expect(bad.status).toBe(401)

    const missing = await request(app.getHttpServer()).get('/api/v1/auth/me')
    expect(missing.status).toBe(401)
  })

  it('logs in an existing account', async () => {
    const { email, password } = await signup(app)
    const res = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password })
    expect(res.status).toBe(201)
    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', cookieHeader(res))
    expect(me.body.user.email).toBe(email)
  })
})
