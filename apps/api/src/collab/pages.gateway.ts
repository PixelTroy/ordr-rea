import { Inject, Logger } from '@nestjs/common'
import {
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import * as jwt from 'jsonwebtoken'
import { Server, Socket } from 'socket.io'
import { PrismaService } from '../prisma/prisma.service'
import { accessSecret } from '../auth/token.util'
import { PagesService } from './pages.service'

function cookieValue(header: string | undefined, name: string) {
  if (!header) return ''
  const part = header
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`))
  return part ? decodeURIComponent(part.slice(name.length + 1)) : ''
}

@WebSocketGateway({
  cors: { origin: (process.env.WEB_ORIGIN || 'http://localhost:3000').split(','), credentials: true },
})
export class PagesGateway implements OnGatewayConnection {
  private readonly logger = new Logger(PagesGateway.name)

  @WebSocketServer()
  server!: Server

  constructor(
    @Inject(PagesService) private readonly pages: PagesService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = cookieValue(client.handshake.headers.cookie, 'ordr_access')
      const payload = jwt.verify(token, accessSecret()) as { sub?: string; sid?: string; type?: string }
      if (payload.type !== 'access' || !payload.sub || !payload.sid) throw new Error('invalid token')
      const session = await this.prisma.session.findUnique({ where: { id: payload.sid } })
      if (!session || session.revokedAt || session.userId !== payload.sub) throw new Error('revoked')
      const pageId = String(client.handshake.auth?.pageId || '')
      if (!pageId) throw new Error('missing page')
      const state = await this.pages.state(payload.sub, pageId)
      client.data.userId = payload.sub
      client.data.pageId = pageId
      await client.join(pageId)
      client.emit('sync', state.toString('base64'))
    } catch (error) {
      this.logger.warn(`Page socket rejected: ${error instanceof Error ? error.message : 'unauthorized'}`)
      client.disconnect()
    }
  }

  @SubscribeMessage('update')
  async update(client: Socket, payload: { pageId?: string; update?: string }) {
    const pageId = payload?.pageId || client.data.pageId
    const userId = client.data.userId as string | undefined
    if (!pageId || !userId || !payload?.update) return
    const bytes = Buffer.from(payload.update, 'base64')
    await this.pages.applyUpdate(userId, pageId, bytes)
    client.to(pageId).emit('update', payload.update)
  }
}
