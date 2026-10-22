import { Inject, Injectable } from '@nestjs/common'
import { Webhook } from '@prisma/client'
import { createHmac } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'

const RESOURCE: Record<string, string> = {
  project: 'projects',
  cycle: 'cycles',
  issue: 'issues',
  module: 'modules',
  comment: 'comments',
}

export function webhookMatches(events: unknown, event: string): boolean {
  const [resource, verb] = event.split('.')
  const key = RESOURCE[resource] || resource
  if (Array.isArray(events)) return events.map(String).includes(event)
  if (!events || typeof events !== 'object') return false
  const record = events as { v1?: unknown; v2?: unknown }
  const scopes = Array.isArray(record.v1) ? record.v1.map(String) : []
  const verbs = Array.isArray(record.v2) ? record.v2.map(String) : []
  if (!scopes.includes(key)) return false
  return verbs.length === 0 || verbs.includes(verb)
}

@Injectable()
export class WebhooksService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async emit(workspaceId: string, event: string, payload: Record<string, unknown>) {
    let hooks: Webhook[] = []
    try {
      hooks = await this.prisma.webhook.findMany({ where: { workspaceId, isActive: true } })
    } catch {
      return
    }
    await Promise.all(hooks.map((hook) => this.deliver(hook, event, payload)))
  }

  private async deliver(hook: Webhook, event: string, payload: Record<string, unknown>) {
    if (!webhookMatches(hook.events, event)) return
    const body = JSON.stringify({ event, payload })
    const signature = createHmac('sha256', hook.secret).update(body).digest('hex')
    let statusCode: number | null = null
    let response = ''
    let success = false
    try {
      const res = await fetch(hook.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'X-Ordr-Signature': signature },
        body,
        signal: AbortSignal.timeout(4000),
      })
      statusCode = res.status
      response = (await res.text()).slice(0, 500)
      success = res.ok
    } catch (error) {
      response = (error instanceof Error ? error.message : 'delivery failed').slice(0, 500)
    }
    try {
      await this.prisma.webhookDelivery.create({
        data: { webhookId: hook.id, event, success, statusCode, response },
      })
    } catch {
      // A failed log row should not fail the action that triggered the hook.
    }
  }
}
