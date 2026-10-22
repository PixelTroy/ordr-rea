import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { PrismaService } from '../src/prisma/prisma.service'
import { createTestApp, resetDatabase, signup } from './app'

describe('workspaces', () => {
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

  async function owner() {
    const account = await signup(app, { email: 'owner@example.com', displayName: 'Owner' })
    const created = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Cookie', account.cookies)
      .send({ name: 'Alpha Lab', slug: 'alpha-lab', timezone: 'UTC' })
    return { ...account, created }
  }

  it('creates a workspace and lets the owner update settings', async () => {
    const { cookies, created } = await owner()
    expect(created.status).toBe(201)
    expect(created.body.workspace.slug).toBe('alpha-lab')
    expect(created.body.membership).toEqual({ role: 'ADMIN', isOwner: true })

    const listed = await request(app.getHttpServer()).get('/api/v1/workspaces').set('Cookie', cookies)
    expect(listed.body.workspaces).toHaveLength(1)

    const updated = await request(app.getHttpServer())
      .patch('/api/v1/workspaces/alpha-lab')
      .set('Cookie', cookies)
      .send({ name: 'Alpha', timezone: 'Asia/Shanghai', description: 'Lab notes' })
    expect(updated.status).toBe(200)
    expect(updated.body.workspace.name).toBe('Alpha')
    expect(updated.body.workspace.timezone).toBe('Asia/Shanghai')

    const second = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Cookie', cookies)
      .send({ name: 'Beta', slug: 'beta' })
    expect(second.status).toBe(201)
    const both = await request(app.getHttpServer()).get('/api/v1/workspaces').set('Cookie', cookies)
    expect(both.body.workspaces.map((item: { slug: string }) => item.slug).sort()).toEqual([
      'alpha-lab',
      'beta',
    ])
  })

  it('rejects duplicate, invalid, and reserved slugs', async () => {
    const { cookies } = await owner()
    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Cookie', cookies)
      .send({ name: 'Again', slug: 'alpha-lab' })
    expect(duplicate.status).toBe(409)

    const invalid = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Cookie', cookies)
      .send({ name: 'Bad', slug: 'No Spaces' })
    expect(invalid.status).toBe(400)

    const reserved = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Cookie', cookies)
      .send({ name: 'Login', slug: 'login' })
    expect(reserved.status).toBe(400)
  })

  it('hides settings changes from members and guests and limits deletion to the owner', async () => {
    const { cookies } = await owner()
    const member = await signup(app, { email: 'member@example.com', displayName: 'Member' })
    const guest = await signup(app, { email: 'guest@example.com', displayName: 'Guest' })

    const memberInvite = await request(app.getHttpServer())
      .post('/api/v1/workspaces/alpha-lab/invites')
      .set('Cookie', cookies)
      .send({ email: member.email, role: 'MEMBER' })
    const guestInvite = await request(app.getHttpServer())
      .post('/api/v1/workspaces/alpha-lab/invites')
      .set('Cookie', cookies)
      .send({ email: guest.email, role: 'GUEST' })

    await request(app.getHttpServer())
      .post(`/api/v1/invites/${memberInvite.body.acceptUrl.split('/invite/')[1]}/accept`)
      .set('Cookie', member.cookies)
    await request(app.getHttpServer())
      .post(`/api/v1/invites/${guestInvite.body.acceptUrl.split('/invite/')[1]}/accept`)
      .set('Cookie', guest.cookies)

    const memberPatch = await request(app.getHttpServer())
      .patch('/api/v1/workspaces/alpha-lab')
      .set('Cookie', member.cookies)
      .send({ name: 'Hijack' })
    expect(memberPatch.status).toBe(403)

    const guestInviteAttempt = await request(app.getHttpServer())
      .post('/api/v1/workspaces/alpha-lab/invites')
      .set('Cookie', guest.cookies)
      .send({ email: 'other@example.com', role: 'MEMBER' })
    expect(guestInviteAttempt.status).toBe(403)

    const outsider = await signup(app, { email: 'outsider@example.com' })
    const denied = await request(app.getHttpServer())
      .get('/api/v1/workspaces/alpha-lab')
      .set('Cookie', outsider.cookies)
    expect(denied.status).toBe(403)

    const memberDelete = await request(app.getHttpServer())
      .delete('/api/v1/workspaces/alpha-lab')
      .set('Cookie', member.cookies)
      .send({ confirmSlug: 'alpha-lab' })
    expect(memberDelete.status).toBe(403)

    const wrongConfirm = await request(app.getHttpServer())
      .delete('/api/v1/workspaces/alpha-lab')
      .set('Cookie', cookies)
      .send({ confirmSlug: 'nope' })
    expect(wrongConfirm.status).toBe(400)

    const removed = await request(app.getHttpServer())
      .delete('/api/v1/workspaces/alpha-lab')
      .set('Cookie', cookies)
      .send({ confirmSlug: 'alpha-lab' })
    expect(removed.status).toBe(200)
    const gone = await request(app.getHttpServer())
      .get('/api/v1/workspaces/alpha-lab')
      .set('Cookie', cookies)
    expect(gone.status).toBe(404)
  })
})
