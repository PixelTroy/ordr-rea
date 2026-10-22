import { INestApplication } from '@nestjs/common'
import * as Y from 'yjs'
import request from 'supertest'
import { PagesService } from '../src/collab/pages.service'
import { PrismaService } from '../src/prisma/prisma.service'
import { createTestApp, resetDatabase, signup } from './app'

describe('pages, comments, and notifications', () => {
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

  it('stores a collaborative update and notifies mentions and assignees', async () => {
    const owner = await signup(app, { email: 'owner@example.com', displayName: 'Ada' })
    await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Cookie', owner.cookies)
      .send({ name: 'Alpha Lab', slug: 'alpha-lab' })
    const invite = await request(app.getHttpServer())
      .post('/api/v1/workspaces/alpha-lab/invites')
      .set('Cookie', owner.cookies)
      .send({ email: 'grace@example.com', role: 'MEMBER' })
    const token = String(invite.body.acceptUrl).split('/invite/')[1]
    const member = await signup(app, { email: 'grace@example.com', displayName: 'Grace' })
    await request(app.getHttpServer()).post(`/api/v1/invites/${token}/accept`).set('Cookie', member.cookies)
    const me = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', member.cookies)

    const project = await request(app.getHttpServer())
      .post('/api/v1/workspaces/alpha-lab/projects')
      .set('Cookie', owner.cookies)
      .send({ name: 'Clone Research', identifier: 'CLONE' })
    const projectId = project.body.project.id as string
    const page = await request(app.getHttpServer())
      .post('/api/v1/workspaces/alpha-lab/pages')
      .set('Cookie', owner.cookies)
      .send({ title: 'Competitor Research Spec', projectId, access: 'PUBLIC' })
    expect(page.status).toBe(201)

    const doc = new Y.Doc()
    doc.getText('draft').insert(0, 'Spec body')
    const ownerMe = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', owner.cookies)
    await app.get(PagesService).applyUpdate(ownerMe.body.user.id, page.body.page.id, Y.encodeStateAsUpdate(doc))
    const stored = await prisma.page.findUniqueOrThrow({ where: { id: page.body.page.id } })
    expect(stored.yjsState?.length).toBeGreaterThan(0)

    const issue = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/alpha-lab/projects/${projectId}/issues`)
      .set('Cookie', owner.cookies)
      .send({ title: 'Survey competitors' })
    await request(app.getHttpServer())
      .put(`/api/v1/workspaces/alpha-lab/projects/${projectId}/issues/${issue.body.issue.id}/assignees`)
      .set('Cookie', owner.cookies)
      .send({ assigneeIds: [me.body.user.id] })
    const comment = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/alpha-lab/projects/${projectId}/issues/${issue.body.issue.id}/comments`)
      .set('Cookie', owner.cookies)
      .send({
        bodyJson: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'mention', attrs: { id: me.body.user.id, label: 'Grace' } },
                { type: 'text', text: ' please review' },
              ],
            },
          ],
        },
      })
    expect(comment.status).toBe(201)
    expect(comment.body.comment.bodyText).toContain('@Grace')

    const inbox = await request(app.getHttpServer())
      .get('/api/v1/workspaces/alpha-lab/notifications?mentions=1')
      .set('Cookie', member.cookies)
    expect(inbox.body.notifications.map((item: { type: string }) => item.type)).toContain('mention')
    const all = await request(app.getHttpServer())
      .get('/api/v1/workspaces/alpha-lab/notifications')
      .set('Cookie', member.cookies)
    expect(all.body.notifications.map((item: { type: string }) => item.type)).toEqual(
      expect.arrayContaining(['mention', 'assignment']),
    )
  })
})
