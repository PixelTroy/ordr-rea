'use client'

import { useParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ApiError, api } from '@/lib/api'
import { BoardFilters, WorkItemsBoard } from '@/components/work/work-items-board'
import { Button, ErrorText, Spinner } from '@/components/ui'

type SavedView = {
  id: string
  name: string
  description: string
  access: 'PUBLIC' | 'PRIVATE'
  layout: string
  filters: Partial<BoardFilters>
  favorited: boolean
}

export default function ViewDetailPage() {
  const params = useParams<{ workspaceSlug: string; projectId: string; viewId: string }>()
  const [view, setView] = useState<SavedView | null>(null)
  const [error, setError] = useState('')
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    api<{ view: SavedView }>(
      `/api/v1/workspaces/${params.workspaceSlug}/projects/${params.projectId}/views/${params.viewId}`,
    )
      .then((body) => setView(body.view))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'View not found'))
  }, [params.projectId, params.viewId, params.workspaceSlug])

  function patch(body: Record<string, unknown>) {
    return api<{ view: SavedView }>(
      `/api/v1/workspaces/${params.workspaceSlug}/projects/${params.projectId}/views/${params.viewId}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ).then((next) => setView(next.view))
  }

  if (!view) return error ? <ErrorText>{error}</ErrorText> : <Spinner />

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold" data-testid="view-title">
            {view.name}
          </h2>
          {view.description ? <p className="truncate text-sm text-muted">{view.description}</p> : null}
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-muted">Share</span>
          <select
            data-testid="view-share"
            className="h-8 rounded-md border border-line px-2"
            value={view.access}
            onChange={(event) => {
              patch({ access: event.target.value }).catch((err: unknown) =>
                setError(err instanceof ApiError ? err.message : 'Could not update sharing'),
              )
            }}
          >
            <option value="PUBLIC">Public</option>
            <option value="PRIVATE">Private</option>
          </select>
        </label>
        <Button
          variant="secondary"
          data-testid="view-favorite"
          onClick={() => {
            api<{ view: SavedView }>(
              `/api/v1/workspaces/${params.workspaceSlug}/projects/${params.projectId}/views/${params.viewId}/favorite`,
              { method: 'POST' },
            )
              .then((body) => setView(body.view))
              .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not favorite the view'))
          }}
        >
          {view.favorited ? 'Favorited' : 'Favorite'}
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <WorkItemsBoard
          slug={params.workspaceSlug}
          projectId={params.projectId}
          view={{
            id: view.id,
            layout: view.layout,
            filters: view.filters,
            onLayoutChange: (layout) => {
              patch({ layout: layout.toUpperCase() }).catch(() => undefined)
            },
            onFiltersChange: (filters) => {
              window.clearTimeout(timer.current)
              timer.current = window.setTimeout(() => {
                patch({ filters }).catch(() => undefined)
              }, 400)
            },
          }}
        />
      </div>
    </div>
  )
}
