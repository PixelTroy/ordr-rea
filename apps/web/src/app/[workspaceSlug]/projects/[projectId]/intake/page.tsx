'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ApiError, api } from '@/lib/api'
import { Button, EmptyState, ErrorText, Spinner, TextArea, TextField } from '@/components/ui'

type Intake = {
  id: string
  title: string
  description: string
  status: string
  createdAt: string
  key: string | null
  createdBy: { displayName: string }
}

export default function IntakePage() {
  const params = useParams<{ workspaceSlug: string; projectId: string }>()
  const [closed, setClosed] = useState(false)
  const [items, setItems] = useState<Intake[]>([])
  const [selected, setSelected] = useState<string>('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  function load() {
    setLoading(true)
    api<{ intake: Intake[] }>(
      `/api/v1/workspaces/${params.workspaceSlug}/projects/${params.projectId}/intake${closed ? '?closed=1' : ''}`,
    )
      .then((body) => {
        setItems(body.intake)
        setSelected((current) => (body.intake.some((item) => item.id === current) ? current : body.intake[0]?.id || ''))
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load intake'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [closed, params.projectId, params.workspaceSlug])

  async function create(event: FormEvent) {
    event.preventDefault()
    await api(`/api/v1/workspaces/${params.workspaceSlug}/projects/${params.projectId}/intake`, {
      method: 'POST',
      body: JSON.stringify({ title, description }),
    })
    setTitle('')
    setDescription('')
    setOpen(false)
    load()
  }

  async function decide(id: string, action: 'accept' | 'decline') {
    await api(`/api/v1/workspaces/${params.workspaceSlug}/projects/${params.projectId}/intake/${id}/${action}`, {
      method: 'POST',
    })
    load()
  }

  const current = items.find((item) => item.id === selected)
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2">
        <button type="button" className={`rounded-md px-3 py-1 text-sm ${!closed ? 'bg-canvas font-medium' : ''}`} onClick={() => setClosed(false)}>
          Open
        </button>
        <button type="button" className={`rounded-md px-3 py-1 text-sm ${closed ? 'bg-canvas font-medium' : ''}`} onClick={() => setClosed(true)}>
          Closed
        </button>
        <Button className="ml-auto" data-testid="intake-add" onClick={() => setOpen((value) => !value)}>
          Add work item
        </Button>
      </div>
      {open ? (
        <form className="space-y-2 border-b border-line p-4" onSubmit={create}>
          <TextField label="Title" data-testid="intake-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
          <TextArea label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
          <Button type="submit" data-testid="intake-submit">
            Submit to intake
          </Button>
        </form>
      ) : null}
      <ErrorText>{error}</ErrorText>
      {loading ? <Spinner /> : null}
      {!loading && items.length === 0 ? <EmptyState title="Intake is clear" body="Pending requests show up here until someone accepts or declines them." /> : null}
      {!loading && items.length > 0 ? (
        <div className="grid min-h-0 flex-1 md:grid-cols-[320px_1fr]">
          <div className="border-r border-line">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item.id)}
                className={`block w-full border-b border-line px-4 py-3 text-left text-sm ${selected === item.id ? 'bg-canvas' : ''}`}
              >
                <span className="rounded bg-amber-100 px-1.5 text-[11px] text-amber-800">{item.status}</span>
                <p className="mt-1 font-medium">{item.title}</p>
              </button>
            ))}
          </div>
          {current ? (
            <div className="p-6">
              <h2 className="text-xl font-semibold">{current.title}</h2>
              <p className="mt-2 text-sm text-muted">{current.description || 'No description'}</p>
              <p className="mt-4 text-xs text-muted">Intake source · {current.createdBy.displayName}</p>
              {current.key ? <p className="mt-2 text-sm">Accepted as {current.key}</p> : null}
              {current.status === 'PENDING' ? (
                <div className="mt-4 flex gap-2">
                  <Button data-testid="intake-accept" onClick={() => decide(current.id, 'accept')}>
                    Accept
                  </Button>
                  <Button variant="secondary" onClick={() => decide(current.id, 'decline')}>
                    Decline
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
