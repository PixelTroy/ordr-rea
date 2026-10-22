'use client'

import { FormEvent, useEffect, useState } from 'react'
import { ApiError, api } from '@/lib/api'
import { Button, ErrorText, Modal, TextArea, TextField } from '@/components/ui'
import { useWorkspace } from '@/components/shell/workspace-provider'

type TokenRow = {
  id: string
  title: string
  description: string
  prefix: string
  expiresAt: string | null
  lastUsedAt: string | null
  createdAt: string
}

export default function AccessTokensPage() {
  const { slug } = useWorkspace()
  const [tokens, setTokens] = useState<TokenRow[]>([])
  const [open, setOpen] = useState(false)
  const [revealed, setRevealed] = useState('')
  const [error, setError] = useState('')

  function reload() {
    api<{ tokens: TokenRow[] }>(`/api/v1/workspaces/${slug}/access-tokens`)
      .then((body) => setTokens(body.tokens))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load tokens'))
  }

  useEffect(() => {
    reload()
  }, [slug])

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-xl font-semibold">Access tokens</h2>
          <p className="mt-1 text-sm text-muted">
            Personal tokens for this workspace. Send <span className="font-mono">Authorization: Bearer ordr_…</span>. The secret is shown once.
          </p>
        </div>
        <Button className="ml-auto" data-testid="add-token" onClick={() => setOpen(true)}>
          Add token
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
      {revealed ? (
        <div className="mt-4 rounded-md border border-line bg-canvas p-3 text-sm">
          <p className="font-medium">Copy this token now. It will not be shown again.</p>
          <p className="mt-2 break-all font-mono text-xs" data-testid="token-secret">
            {revealed}
          </p>
        </div>
      ) : null}
      <ul className="mt-6 divide-y divide-line rounded-lg border border-line">
        {tokens.length === 0 ? <li className="px-4 py-6 text-sm text-muted">No tokens yet.</li> : null}
        {tokens.map((token) => (
          <li key={token.id} className="flex items-center gap-3 px-4 py-3" data-testid="token-row">
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{token.title}</span>
              <span className="block text-xs text-muted">
                {token.prefix}… · {token.expiresAt ? `Expires ${token.expiresAt.slice(0, 10)}` : 'Never expires'}
                {token.lastUsedAt ? ` · Last used ${token.lastUsedAt.slice(0, 10)}` : ''}
              </span>
            </span>
            <Button
              variant="danger"
              onClick={() => {
                api(`/api/v1/workspaces/${slug}/access-tokens/${token.id}`, { method: 'DELETE' })
                  .then(reload)
                  .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not delete the token'))
              }}
            >
              Revoke
            </Button>
          </li>
        ))}
      </ul>
      {open ? (
        <CreateToken
          slug={slug}
          onClose={() => setOpen(false)}
          onCreated={(secret) => {
            setRevealed(secret)
            setOpen(false)
            reload()
          }}
        />
      ) : null}
    </div>
  )
}

function CreateToken({
  slug,
  onClose,
  onCreated,
}: {
  slug: string
  onClose: () => void
  onCreated: (secret: string) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [never, setNever] = useState(true)
  const [expiresAt, setExpiresAt] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      const body = await api<{ token: string }>(`/api/v1/workspaces/${slug}/access-tokens`, {
        method: 'POST',
        body: JSON.stringify({ title, description, expiresAt: never ? null : expiresAt }),
      })
      onCreated(body.token)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not generate the token')
      setPending(false)
    }
  }

  return (
    <Modal title="Generate token" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <TextField label="Title" data-testid="token-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
        <TextArea label="Description" data-testid="token-description" value={description} onChange={(event) => setDescription(event.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input data-testid="token-never" type="checkbox" checked={never} onChange={(event) => setNever(event.target.checked)} />
          Never expires
        </label>
        {never ? null : (
          <TextField label="Expiration" type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} required />
        )}
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end">
          <Button type="submit" data-testid="token-submit" disabled={pending}>
            {pending ? 'Generating…' : 'Generate token'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
