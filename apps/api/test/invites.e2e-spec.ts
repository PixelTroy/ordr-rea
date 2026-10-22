import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { PrismaService } from '../src/prisma/prisma.service'
import { createTestApp, resetDatabase, signup } from './app'

describe('invites', () => {
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

  async function workspaceOwner() {
    const account = await signup(app, { email: 'owner@example.com', displayName: 'Owner' })
    await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Cookie', account.cookies)
      .send({ name: 'Alpha Lab', slug: 'alpha-lab' })
    return account
  }

  it('creates an invite link, accepts it, and blocks members from inviting', async () => {
    const owner = await workspaceOwner()
    const created = await request(app.getHttpServer())
      .post('/api/v1/workspaces/alpha-lab/invites')
      .set('Cookie', owner.cookies)
      .send({ email: 'grace@example.com', role: 'MEMBER' })
    expect(created.status).toBe(201)
    expect(created.body.acceptUrl).toMatch(/\/invite\//)
    expect(created.body.invite.email).toBe('grace@example.com')

    const token = created.body.acceptUrl.split('/invite/')[1]
    const preview = await request(app.getHttpServer()).get(`/api/v1/invites/${token}`)
    expect(preview.status).toBe(200)
    expect(preview.body.workspaceSlug).toBe('alpha-lab')
    expect(preview.body.role).toBe('MEMBER')

    const invitee = await signup(app, { email: 'grace@example.com', displayName: 'Grace' })
    const accepted = await request(app.getHttpServer())
      .post(`/api/v1/invites/${token}/accept`)
      .set('Cookie', invitee.cookies)
    expect(accepted.status).toBe(201)
    expect(accepted.body.workspace.slug).toBe('alpha-lab')

    const members = await request(app.getHttpServer())
      .get('/api/v1/workspaces/alpha-lab/members')
      .set('Cookie', owner.cookies)
    expect(members.body.members.map((member: { user: { email: string }; role: string }) => ({
      email: member.user.email,
      role: member.role,
    }))).toEqual(
      expect.arrayContaining([
        { email: 'owner@example.com', role: 'ADMIN' },
        { email: 'grace@example.com', role: 'MEMBER' },
      ]),
    )

    const again = await request(app.getHttpServer())
      .post(`/api/v1/invites/${token}/accept`)
      .set('Cookie', invitee.cookies)
    expect(again.status).toBe(400)

    const forbidden = await request(app.getHttpServer())
      .post('/api/v1/workspaces/alpha-lab/invites')
      .set('Cookie', invitee.cookies)
      .send({ email: 'new@example.com', role: 'GUEST' })
    expect(forbidden.status).toBe(403)

    const home = await request(app.getHttpServer())
      .get('/api/v1/workspaces/alpha-lab')
      .set('Cookie', invitee.cookies)
    expect(home.status).toBe(200)
    expect(home.body.membership).toEqual({ role: 'MEMBER', isOwner: false })
  })

  it('rejects the wrong account, expired tokens, and duplicate members', async () => {
    const owner = await workspaceOwner()
    const created = await request(app.getHttpServer())
      .post('/api/v1/workspaces/alpha-lab/invites')
      .set('Cookie', owner.cookies)
      .send({ email: 'guest@example.com', role: 'GUEST' })
    const token = created.body.acceptUrl.split('/invite/')[1]

    const other = await signup(app, { email: 'other@example.com' })
    const mismatch = await request(app.getHttpServer())
      .post(`/api/v1/invites/${token}/accept`)
      .set('Cookie', other.cookies)
    expect(mismatch.status).toBe(403)

    await prisma.workspaceInvite.update({
      where: { token },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    const guest = await signup(app, { email: 'guest@example.com' })
    const expired = await request(app.getHttpServer())
      .post(`/api/v1/invites/${token}/accept`)
      .set('Cookie', guest.cookies)
    expect(expired.status).toBe(400)

    const fresh = await request(app.getHttpServer())
      .post('/api/v1/workspaces/alpha-lab/invites')
      .set('Cookie', owner.cookies)
      .send({ email: 'guest@example.com', role: 'GUEST' })
    const freshToken = fresh.body.acceptUrl.split('/invite/')[1]
    const accepted = await request(app.getHttpServer())
      .post(`/api/v1/invites/${freshToken}/accept`)
      .set('Cookie', guest.cookies)
    expect(accepted.status).toBe(201)
    expect(accepted.body.workspace.slug).toBe('alpha-lab')

    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/workspaces/alpha-lab/invites')
      .set('Cookie', owner.cookies)
      .send({ email: 'guest@example.com', role: 'MEMBER' })
    expect(duplicate.status).toBe(409)

    const listed = await request(app.getHttpServer())
      .get('/api/v1/workspaces/alpha-lab/members')
      .set('Cookie', guest.cookies)
    const guestRow = listed.body.members.find(
      (member: { user: { email: string } }) => member.user.email === 'guest@example.com',
    )
    expect(guestRow.role).toBe('GUEST')
    expect(guestRow.isOwner).toBe(false)
  })
})
