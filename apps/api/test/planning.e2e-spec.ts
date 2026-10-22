import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { PrismaService } from '../src/prisma/prisma.service'
import { createTestApp, resetDatabase, signup } from './app'

function iso(offset: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

describe('cycles and modules', () => {
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

  it('rejects overlapping cycles and reports burn-down after work is completed', async () => {
    const owner = await signup(app, { email: 'owner@example.com', displayName: 'Owner' })
    const workspace = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Cookie', owner.cookies)
      .send({ name: 'Alpha Lab', slug: 'alpha-lab' })
    expect(workspace.status).toBe(201)
    const project = await request(app.getHttpServer())
      .post('/api/v1/workspaces/alpha-lab/projects')
      .set('Cookie', owner.cookies)
      .send({ name: 'Clone Research', identifier: 'CLONE' })
    const projectId = project.body.project.id as string

    const cycle = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/alpha-lab/projects/${projectId}/cycles`)
      .set('Cookie', owner.cookies)
      .send({ name: 'Sprint Alpha', startDate: iso(0), endDate: iso(10) })
    expect(cycle.status).toBe(201)
    expect(cycle.body.cycle.status).toBe('ACTIVE')
    const cycleId = cycle.body.cycle.id as string

    const overlap = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/alpha-lab/projects/${projectId}/cycles`)
      .set('Cookie', owner.cookies)
      .send({ name: 'Sprint Clash', startDate: iso(5), endDate: iso(12) })
    expect(overlap.status).toBe(400)

    const upcoming = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/alpha-lab/projects/${projectId}/cycles`)
      .set('Cookie', owner.cookies)
      .send({ name: 'Sprint Beta', startDate: iso(11), endDate: iso(20) })
    expect(upcoming.status).toBe(201)
    expect(upcoming.body.cycle.status).toBe('UPCOMING')

    const issue = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/alpha-lab/projects/${projectId}/issues`)
      .set('Cookie', owner.cookies)
      .send({ title: 'Survey competitors', cycleId })
    expect(issue.status).toBe(201)
    expect(issue.body.issue.cycle.name).toBe('Sprint Alpha')

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/workspaces/alpha-lab/projects/${projectId}`)
      .set('Cookie', owner.cookies)
    const done = (detail.body.project.states as Array<{ id: string; group: string }>).find((state) => state.group === 'COMPLETED')
    const moved = await request(app.getHttpServer())
      .patch(`/api/v1/workspaces/alpha-lab/projects/${projectId}/issues/${issue.body.issue.id}`)
      .set('Cookie', owner.cookies)
      .send({ stateId: done!.id })
    expect(moved.status).toBe(200)

    const again = await request(app.getHttpServer())
      .get(`/api/v1/workspaces/alpha-lab/projects/${projectId}/cycles/${cycleId}`)
      .set('Cookie', owner.cookies)
    expect(again.body.cycle.progress.completed).toBe(1)
    expect(again.body.cycle.progress.leadBy).toBeGreaterThan(0)
    expect(again.body.cycle.progress.burndown.length).toBeGreaterThan(1)

    const active = await request(app.getHttpServer())
      .get('/api/v1/workspaces/alpha-lab/active-cycles')
      .set('Cookie', owner.cookies)
    expect(active.body.cycles.map((item: { name: string }) => item.name)).toEqual(['Sprint Alpha'])

    const module = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/alpha-lab/projects/${projectId}/modules`)
      .set('Cookie', owner.cookies)
      .send({ name: 'Competitor Teardown', status: 'IN_PROGRESS', startDate: iso(0), targetDate: iso(20) })
    expect(module.status).toBe(201)
    const linked = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/alpha-lab/projects/${projectId}/modules/${module.body.module.id}/issues`)
      .set('Cookie', owner.cookies)
      .send({ issueIds: [issue.body.issue.id] })
    expect(linked.body.module.issues.map((item: { key: string }) => item.key)).toEqual(['CLONE-1'])
    expect(linked.body.module.progress.completed).toBe(1)
  })
})
