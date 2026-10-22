import { createHmac } from 'crypto'
import { createServer, Server } from 'http'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { PrismaService } from '../src/prisma/prisma.service'
import { createTestApp, resetDatabase, signup } from './app'

describe('views, search, tokens, and webhooks', () => {
  let app: INestApplication
  let prisma: PrismaService
  let sink: { server: Server; port: number; hits: Array<{ signature: string; body: string }> }

  beforeAll(async () => {
    const created = await createTestApp()
    app = created.app
    prisma = created.prisma
    sink = await new Promise((resolve) => {
      const hits: Array<{ signature: string; body: string }> = []
      const server = createServer((req, res) => {
        const chunks: Buffer[] = []
        req.on('data', (chunk) => chunks.push(chunk))
        req.on('end', () => {
          hits.push({
            signature: String(req.headers['x-ordr-signature'] || ''),
            body: Buffer.concat(chunks).toString('utf8'),
          })
          res.writeHead(204)
          res.end()
        })
      })
      server.listen(0, '127.0.0.1', () => {
        const address = server.address()
        const port = typeof address === 'object' && address ? address.port : 0
        resolve({ server, port, hits })
      })
    })
  })

  afterAll(async () => {
    await new Promise((resolve) => sink.server.close(resolve))
    await app.close()
  })

  beforeEach(async () => {
    sink.hits.length = 0
    await resetDatabase(prisma)
  })

  it('saves a filtered view, searches, accepts a bearer token, signs webhooks, and round-trips JSON', async () => {
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
    expect(project.status).toBe(201)
    const projectId = project.body.project.id as string

    const high = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/alpha-lab/projects/${projectId}/issues`)
      .set('Cookie', owner.cookies)
      .send({ title: 'Beacon work', priority: 'HIGH' })
    expect(high.status).toBe(201)
    const low = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/alpha-lab/projects/${projectId}/issues`)
      .set('Cookie', owner.cookies)
      .send({ title: 'Quiet note', priority: 'LOW' })
    expect(low.status).toBe(201)

    const createdView = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/alpha-lab/projects/${projectId}/views`)
      .set('Cookie', owner.cookies)
      .send({ name: 'High priority', description: 'Urgent queue', access: 'PUBLIC', layout: 'LIST', filters: { priority: 'HIGH' } })
    expect(createdView.status).toBe(201)
    expect(createdView.body.view.filters).toEqual({ priority: 'HIGH' })
    const viewId = createdView.body.view.id as string

    const favorite = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/alpha-lab/projects/${projectId}/views/${viewId}/favorite`)
      .set('Cookie', owner.cookies)
    expect(favorite.status).toBe(201)
    expect(favorite.body.view.favorited).toBe(true)

    const filtered = await request(app.getHttpServer())
      .get(`/api/v1/workspaces/alpha-lab/projects/${projectId}/issues`)
      .query({ priority: 'HIGH' })
      .set('Cookie', owner.cookies)
    expect(filtered.status).toBe(200)
    expect(filtered.body.issues).toHaveLength(1)
    expect(filtered.body.issues[0].title).toBe('Beacon work')

    const found = await request(app.getHttpServer())
      .get('/api/v1/workspaces/alpha-lab/search')
      .query({ q: 'Beacon' })
      .set('Cookie', owner.cookies)
    expect(found.status).toBe(200)
    expect(found.body.results.some((row: { type: string; title: string }) => row.type === 'issue' && row.title === 'Beacon work')).toBe(true)

    const token = await request(app.getHttpServer())
      .post('/api/v1/workspaces/alpha-lab/access-tokens')
      .set('Cookie', owner.cookies)
      .send({ title: 'CI', description: 'local', expiresAt: null })
    expect(token.status).toBe(201)
    expect(token.body.token).toMatch(/^ordr_/)
    const listed = await request(app.getHttpServer())
      .get('/api/v1/workspaces/alpha-lab/projects')
      .set('Authorization', `Bearer ${token.body.token}`)
    expect(listed.status).toBe(200)
    expect(listed.body.projects[0].identifier).toBe('CLONE')

    const other = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Cookie', owner.cookies)
      .send({ name: 'Other', slug: 'other-lab' })
    expect(other.status).toBe(201)
    const denied = await request(app.getHttpServer())
      .get('/api/v1/workspaces/other-lab/projects')
      .set('Authorization', `Bearer ${token.body.token}`)
    expect(denied.status).toBe(401)

    await prisma.apiToken.update({
      where: { id: token.body.accessToken.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    const expired = await request(app.getHttpServer())
      .get('/api/v1/workspaces/alpha-lab/projects')
      .set('Authorization', `Bearer ${token.body.token}`)
    expect(expired.status).toBe(401)

    const hook = await request(app.getHttpServer())
      .post('/api/v1/workspaces/alpha-lab/webhooks')
      .set('Cookie', owner.cookies)
      .send({
        title: 'Sink',
        url: `http://127.0.0.1:${sink.port}/hook`,
        events: { v1: ['issues'], v2: ['created'] },
      })
    expect(hook.status).toBe(201)
    const secret = hook.body.webhook.secret as string

    const created = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/alpha-lab/projects/${projectId}/issues`)
      .set('Cookie', owner.cookies)
      .send({ title: 'Hooked item' })
    expect(created.status).toBe(201)
    expect(sink.hits).toHaveLength(1)
    const payload = JSON.parse(sink.hits[0].body) as { event: string; payload: { title: string } }
    expect(payload.event).toBe('issue.created')
    expect(payload.payload.title).toBe('Hooked item')
    const expected = createHmac('sha256', secret).update(sink.hits[0].body).digest('hex')
    expect(sink.hits[0].signature).toBe(expected)

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/workspaces/alpha-lab/webhooks/${hook.body.webhook.id}`)
      .set('Cookie', owner.cookies)
    expect(detail.body.webhook.deliveries[0].success).toBe(true)

    const exported = await request(app.getHttpServer())
      .get('/api/v1/workspaces/alpha-lab/export')
      .set('Cookie', owner.cookies)
    expect(exported.status).toBe(200)
    expect(exported.body.projects[0].identifier).toBe('CLONE')
    expect(exported.body.projects[0].issues.length).toBeGreaterThan(0)

    const imported = await request(app.getHttpServer())
      .post('/api/v1/workspaces/other-lab/import')
      .set('Cookie', owner.cookies)
      .send(exported.body)
    expect(imported.status).toBe(201)
    expect(imported.body.projects).toBe(1)
    const copied = await request(app.getHttpServer())
      .get('/api/v1/workspaces/other-lab/projects')
      .set('Cookie', owner.cookies)
    expect(copied.body.projects.some((row: { identifier: string }) => row.identifier === 'CLONE')).toBe(true)
  })
})
