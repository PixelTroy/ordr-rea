'use client'

import { FormEvent, useEffect, useState } from 'react'
import { ApiError, api } from '@/lib/api'
import { Button, ErrorText, Modal, TextField } from '@/components/ui'
import { useWorkspace } from '@/components/shell/workspace-provider'

const SCOPES = [
  ['projects', 'Projects'],
  ['cycles', 'Cycles'],
  ['issues', 'Work Items'],
  ['modules', 'Modules'],
  ['comments', 'Work item comments'],
] as const

const VERBS = ['created', 'updated', 'archived', 'deleted'] as const

type Hook = {
  id: string
  title: string
  url: string
  events: { v1?: string[]; v2?: string[] }
  isActive: boolean
  deliveryCount: number
}

export default function WebhooksPage() {
  const { slug } = useWorkspace()
  const [hooks, setHooks] = useState<Hook[]>([])
  const [open, setOpen] = useState(false)
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')

  function reload() {
    api<{ webhooks: Hook[] }>(`/api/v1/workspaces/${slug}/webhooks`)
      .then((body) => setHooks(body.webhooks))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load webhooks'))
  }

  useEffect(() => {
    reload()
  }, [slug])

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-xl font-semibold">Webhooks</h2>
          <p className="mt-1 text-sm text-muted">
            Deliveries are JSON <span className="font-mono">{'{ event, payload }'}</span> with an <span className="font-mono">X-Ordr-Signature</span> HMAC-SHA256 header.
          </p>
        </div>
        <Button className="ml-auto" data-testid="add-webhook" onClick={() => setOpen(true)}>
          Add webhook
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
      {secret ? (
        <p className="mt-4 break-all rounded-md border border-line bg-canvas p-3 font-mono text-xs" data-testid="webhook-secret">
          Signing secret: {secret}
        </p>
      ) : null}
      <ul className="mt-6 divide-y divide-line rounded-lg border border-line">
        {hooks.length === 0 ? <li className="px-4 py-6 text-sm text-muted">No webhooks yet.</li> : null}
        {hooks.map((hook) => (
          <li key={hook.id} className="px-4 py-3" data-testid="webhook-row">
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{hook.title}</span>
                <span className="block truncate text-xs text-muted">{hook.url}</span>
              </span>
              <span className="text-xs text-muted">{hook.deliveryCount} deliveries</span>
              <Button
                variant="danger"
                onClick={() => {
                  api(`/api/v1/workspaces/${slug}/webhooks/${hook.id}`, { method: 'DELETE' }).then(reload).catch((err: unknown) =>
                    setError(err instanceof ApiError ? err.message : 'Could not delete the webhook'),
                  )
                }}
              >
                Delete
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted">
              {(hook.events.v1 || []).join(', ') || 'no scopes'} · {(hook.events.v2 || []).join(', ') || 'all actions'}
            </p>
          </li>
        ))}
      </ul>
      {open ? (
        <CreateWebhook
          slug={slug}
          onClose={() => setOpen(false)}
          onCreated={(value) => {
            setSecret(value)
            setOpen(false)
            reload()
          }}
        />
      ) : null}
    </div>
  )
}

function CreateWebhook({
  slug,
  onClose,
  onCreated,
}: {
  slug: string
  onClose: () => void
  onCreated: (secret: string) => void
}) {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [scopes, setScopes] = useState<string[]>(['issues'])
  const [verbs, setVerbs] = useState<string[]>(['created', 'updated'])
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  function toggle(list: string[], value: string, set: (next: string[]) => void) {
    set(list.includes(value) ? list.filter((item) => item !== value) : [...list, value])
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      const body = await api<{ webhook: { secret: string } }>(`/api/v1/workspaces/${slug}/webhooks`, {
        method: 'POST',
        body: JSON.stringify({ title, url, events: { v1: scopes, v2: verbs } }),
      })
      onCreated(body.webhook.secret)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the webhook')
      setPending(false)
    }
  }

  return (
    <Modal title="Create webhook" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <TextField label="Title" data-testid="webhook-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
        <TextField label="Payload URL" data-testid="webhook-url" value={url} onChange={(event) => setUrl(event.target.value)} required />
        <fieldset>
          <legend className="mb-1 text-sm font-medium">V1 scopes</legend>
          <div className="space-y-1">
            {SCOPES.map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  data-testid={`webhook-scope-${value}`}
                  type="checkbox"
                  checked={scopes.includes(value)}
                  onChange={() => toggle(scopes, value, setScopes)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-sm font-medium">V2 actions</legend>
          <div className="flex flex-wrap gap-3">
            {VERBS.map((verb) => (
              <label key={verb} className="flex items-center gap-2 text-sm">
                <input
                  data-testid={`webhook-verb-${verb}`}
                  type="checkbox"
                  checked={verbs.includes(verb)}
                  onChange={() => toggle(verbs, verb, setVerbs)}
                />
                {verb}
              </label>
            ))}
          </div>
        </fieldset>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end">
          <Button type="submit" data-testid="webhook-submit" disabled={pending || scopes.length === 0}>
            {pending ? 'Creating…' : 'Create webhook'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
