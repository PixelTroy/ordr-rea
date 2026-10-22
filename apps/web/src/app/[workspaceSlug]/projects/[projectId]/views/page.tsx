'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'
import { LAYOUTS, PAGE_ACCESS } from '@ordr/shared'
import { ApiError, api } from '@/lib/api'
import { Button, EmptyState, ErrorText, Modal, TextArea, TextField } from '@/components/ui'

type SavedView = {
  id: string
  name: string
  description: string
  access: 'PUBLIC' | 'PRIVATE'
  layout: string
  favorited: boolean
}

export default function ViewsPage() {
  const params = useParams<{ workspaceSlug: string; projectId: string }>()
  const [views, setViews] = useState<SavedView[]>([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')

  function reload() {
    api<{ views: SavedView[] }>(`/api/v1/workspaces/${params.workspaceSlug}/projects/${params.projectId}/views`)
      .then((body) => setViews(body.views))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load views'))
  }

  useEffect(() => {
    reload()
  }, [params.projectId, params.workspaceSlug])

  return (
    <div className="px-6 py-5">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">Views</h2>
        <Button className="ml-auto" data-testid="add-view" onClick={() => setOpen(true)}>
          Add view
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
      {views.length === 0 ? (
        <EmptyState title="No views yet" body="Save a filter and layout so the team can reopen it." />
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
          {views.map((view) => (
            <li key={view.id}>
              <Link
                href={`/${params.workspaceSlug}/projects/${params.projectId}/views/${view.id}`}
                data-testid="view-card"
                className="flex items-center gap-3 px-4 py-3 hover:bg-canvas"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{view.name}</span>
                  {view.description ? <span className="block truncate text-sm text-muted">{view.description}</span> : null}
                </span>
                <span className="rounded bg-canvas px-2 py-0.5 text-xs text-muted">{view.access === 'PUBLIC' ? 'Public' : 'Private'}</span>
                <span className="text-xs text-muted">{view.layout}</span>
                {view.favorited ? <span className="text-xs font-medium">Favorited</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <CreateView
          slug={params.workspaceSlug}
          projectId={params.projectId}
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false)
            reload()
          }}
        />
      ) : null}
    </div>
  )
}

function CreateView({
  slug,
  projectId,
  onClose,
  onCreated,
}: {
  slug: string
  projectId: string
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [access, setAccess] = useState<(typeof PAGE_ACCESS)[number]>('PUBLIC')
  const [layout, setLayout] = useState<(typeof LAYOUTS)[number]>('LIST')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      await api(`/api/v1/workspaces/${slug}/projects/${projectId}/views`, {
        method: 'POST',
        body: JSON.stringify({ name, description, access, layout }),
      })
      onCreated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the view')
      setPending(false)
    }
  }

  return (
    <Modal title="Create view" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <TextField label="Title" data-testid="view-name" value={name} onChange={(event) => setName(event.target.value)} required />
        <TextArea label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Access</span>
          <select className="h-9 w-full rounded-md border border-line px-3" value={access} onChange={(event) => setAccess(event.target.value as typeof access)}>
            <option value="PUBLIC">Public</option>
            <option value="PRIVATE">Private</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Layout</span>
          <select className="h-9 w-full rounded-md border border-line px-3" value={layout} onChange={(event) => setLayout(event.target.value as typeof layout)}>
            {LAYOUTS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" data-testid="view-submit" disabled={pending}>
            {pending ? 'Creating…' : 'Create view'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
