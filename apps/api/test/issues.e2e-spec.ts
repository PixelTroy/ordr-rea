import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { PrismaService } from '../src/prisma/prisma.service'
import { createTestApp, resetDatabase, signup } from './app'

describe('projects and work items', () => {
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

  async function workspace(email = 'owner@example.com') {
    const account = await signup(app, { email, displayName: email.split('@')[0] })
    const created = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Cookie', account.cookies)
      .send({ name: 'Alpha Lab', slug: 'alpha-lab' })
    expect(created.status).toBe(201)
    return account
  }

  async function invite(ownerCookies: string, email: string, role: 'MEMBER' | 'GUEST') {
    const created = await request(app.getHttpServer())
      .post('/api/v1/workspaces/alpha-lab/invites')
      .set('Cookie', ownerCookies)
      .send({ email, role })
    expect(created.status).toBe(201)
    const token = String(created.body.acceptUrl).split('/invite/')[1]
    const account = await signup(app, { email, displayName: email.split('@')[0] })
    const accepted = await request(app.getHttpServer())
      .post(`/api/v1/invites/${token}/accept`)
      .set('Cookie', account.cookies)
    expect(accepted.status).toBe(201)
    return account
  }

  async function project(
    cookies: string,
    body: { name?: string; identifier?: string; network?: 'PUBLIC' | 'PRIVATE' } = {},
  ) {
    const created = await request(app.getHttpServer())
      .post('/api/v1/workspaces/alpha-lab/projects')
      .set('Cookie', cookies)
      .send({ name: 'Clone Research', identifier: 'CLONE', ...body })
    return created
  }

  it('creates a project with default states and hides private projects from other members', async () => {
    const owner = await workspace()
    const member = await invite(owner.cookies, 'ada@example.com', 'MEMBER')
    const guest = await invite(owner.cookies, 'guest@example.com', 'GUEST')
    const outsider = await invite(owner.cookies, 'bea@example.com', 'MEMBER')

    const denied = await project(guest.cookies)
    expect(denied.status).toBe(403)

    const created = await project(member.cookies, { network: 'PRIVATE' })
    expect(created.status).toBe(201)
    expect(created.body.project.identifier).toBe('CLONE')
    expect(created.body.project.joined).toBe(true)
    const projectId = created.body.project.id as string

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/workspaces/alpha-lab/projects/${projectId}`)
      .set('Cookie', member.cookies)
    expect(detail.status).toBe(200)
    const states = detail.body.project.states as Array<{ name: string; group: string; isDefault: boolean }>
    expect(states.map((state) => state.name)).toEqual(['Backlog', 'Todo', 'In Progress', 'Done', 'Cancelled'])
    expect(states.find((state) => state.isDefault)?.name).toBe('Backlog')

    const adminList = await request(app.getHttpServer())
      .get('/api/v1/workspaces/alpha-lab/projects')
      .set('Cookie', owner.cookies)
    expect(adminList.body.projects).toHaveLength(1)

    const hidden = await request(app.getHttpServer())
      .get('/api/v1/workspaces/alpha-lab/projects')
      .set('Cookie', outsider.cookies)
    expect(hidden.body.projects).toHaveLength(0)
    const blocked = await request(app.getHttpServer())
      .get(`/api/v1/workspaces/alpha-lab/projects/${projectId}`)
      .set('Cookie', outsider.cookies)
    expect(blocked.status).toBe(403)

    const archived = await request(app.getHttpServer())
      .patch(`/api/v1/workspaces/alpha-lab/projects/${projectId}`)
      .set('Cookie', member.cookies)
      .send({ archived: true })
    expect(archived.status).toBe(200)
    const active = await request(app.getHttpServer())
      .get('/api/v1/workspaces/alpha-lab/projects')
      .set('Cookie', owner.cookies)
    expect(active.body.projects).toHaveLength(0)
    const archives = await request(app.getHttpServer())
      .get('/api/v1/workspaces/alpha-lab/projects?archived=1')
      .set('Cookie', owner.cookies)
    expect(archives.body.projects).toHaveLength(1)
  })

  it('sequences work items and stores priority, assignees, labels, sub-items, and relations', async () => {
    const owner = await workspace()
    const created = await project(owner.cookies)
    const projectId = created.body.project.id as string
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/workspaces/alpha-lab/projects/${projectId}`)
      .set('Cookie', owner.cookies)
    const states = detail.body.project.states as Array<{ id: string; name: string; group: string }>
    const backlog = states.find((state) => state.name === 'Backlog')
    const done = states.find((state) => state.group === 'COMPLETED')
    expect(backlog && done).toBeTruthy()

    const label = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/alpha-lab/projects/${projectId}/labels`)
      .set('Cookie', owner.cookies)
      .send({ name: 'bug', color: '#ef4444' })
    expect(label.status).toBe(201)

    const first = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/alpha-lab/projects/${projectId}/issues`)
      .set('Cookie', owner.cookies)
      .send({ title: 'Survey competitors', priority: 'HIGH', labelIds: [label.body.label.id] })
    expect(first.status).toBe(201)
    expect(first.body.issue.key).toBe('CLONE-1')
    expect(first.body.issue.state.name).toBe('Backlog')
    expect(first.body.issue.priority).toBe('HIGH')
    const issueId = first.body.issue.id as string

    const second = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/alpha-lab/projects/${projectId}/issues`)
      .set('Cookie', owner.cookies)
      .send({ title: 'Write the spec', priority: 'LOW', parentId: issueId })
    expect(second.status).toBe(201)
    expect(second.body.issue.key).toBe('CLONE-2')
    expect(second.body.issue.parent.key).toBe('CLONE-1')

    const me = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', owner.cookies)
    const assigned = await request(app.getHttpServer())
      .put(`/api/v1/workspaces/alpha-lab/projects/${projectId}/issues/${issueId}/assignees`)
      .set('Cookie', owner.cookies)
      .send({ assigneeIds: [me.body.user.id] })
    expect(assigned.body.issue.assignees).toHaveLength(1)

    const labeled = await request(app.getHttpServer())
      .put(`/api/v1/workspaces/alpha-lab/projects/${projectId}/issues/${issueId}/labels`)
      .set('Cookie', owner.cookies)
      .send({ labelIds: [label.body.label.id] })
    expect(labeled.body.issue.labels.map((item: { name: string }) => item.name)).toEqual(['bug'])

    const relation = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/alpha-lab/projects/${projectId}/issues/${issueId}/relations`)
      .set('Cookie', owner.cookies)
      .send({ relatedKey: 'CLONE-2', type: 'BLOCKS' })
    expect(relation.status).toBe(201)

    const moved = await request(app.getHttpServer())
      .patch(`/api/v1/workspaces/alpha-lab/projects/${projectId}/issues/${issueId}`)
      .set('Cookie', owner.cookies)
      .send({ priority: 'URGENT', stateId: done!.id })
    expect(moved.status).toBe(200)
    expect(moved.body.issue.priority).toBe('URGENT')
    expect(moved.body.issue.state.name).toBe('Done')

    const high = await request(app.getHttpServer())
      .get(`/api/v1/workspaces/alpha-lab/projects/${projectId}/issues?priority=URGENT`)
      .set('Cookie', owner.cookies)
    expect(high.body.issues).toHaveLength(1)

    const low = await request(app.getHttpServer())
      .get(`/api/v1/workspaces/alpha-lab/projects/${projectId}/issues?priority=LOW`)
      .set('Cookie', owner.cookies)
    expect(low.body.issues.map((issue: { key: string }) => issue.key)).toEqual(['CLONE-2'])

    const browsed = await request(app.getHttpServer())
      .get('/api/v1/workspaces/alpha-lab/browse/CLONE-1')
      .set('Cookie', owner.cookies)
    expect(browsed.status).toBe(200)
    expect(browsed.body.issue.children.map((issue: { key: string }) => issue.key)).toEqual(['CLONE-2'])
    expect(browsed.body.issue.relations.map((item: { type: string; key: string }) => item.type + ':' + item.key)).toContain(
      'BLOCKS:CLONE-2',
    )
    expect(browsed.body.issue.activity.some((row: { field: string | null }) => row.field === 'priority')).toBe(true)

    const mine = await request(app.getHttpServer())
      .get('/api/v1/workspaces/alpha-lab/work-items?mine=1')
      .set('Cookie', owner.cookies)
    expect(mine.body.issues.map((issue: { key: string }) => issue.key)).toContain('CLONE-1')

    const intake = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/alpha-lab/projects/${projectId}/intake`)
      .set('Cookie', owner.cookies)
      .send({ title: 'A request from outside' })
    expect(intake.status).toBe(201)
    const accepted = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/alpha-lab/projects/${projectId}/intake/${intake.body.intake.id}/accept`)
      .set('Cookie', owner.cookies)
    expect(accepted.status).toBe(201)
    expect(accepted.body.issue.key).toBe('CLONE-3')
  })
})
