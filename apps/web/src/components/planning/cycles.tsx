'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ApiError, api } from '@/lib/api'
import { Button, EmptyState, ErrorText, Modal, Spinner, TextArea, TextField } from '@/components/ui'

export type CycleSummary = {
  id: string
  name: string
  description?: string
  startDate: string
  endDate: string
  status: 'ACTIVE' | 'UPCOMING' | 'COMPLETED'
  lead: { id: string; displayName: string; avatarColor: string } | null
  members: Array<{ id: string; displayName: string; avatarColor: string }>
  progress: {
    total: number
    completed: number
    percent: number
    byGroup: Array<{ group: string; count: number }>
    assignees: Array<{ id: string; name: string; count: number }>
    labels: Array<{ name: string; count: number }>
    burndown: Array<{ date: string; ideal: number; actual: number }>
    leadBy: number
  }
  issues?: Array<{
    id: string
    key: string
    title: string
    priority: string
    state: { name: string; color: string }
    assignees: Array<{ displayName: string }>
    labels: Array<{ name: string; color: string }>
    startDate: string | null
    dueDate: string | null
  }>
}

export function day(value: string) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function isoOffset(days: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function Burndown({ points }: { points: Array<{ date: string; ideal: number; actual: number }> }) {
  const max = Math.max(1, ...points.map((point) => Math.max(point.ideal, point.actual)))
  return (
    <svg viewBox="0 0 120 40" className="h-16 w-full" role="img" aria-label="Burn-down">
      <polyline
        fill="none"
        stroke="#a1a1aa"
        strokeDasharray="2 2"
        points={points.map((point, index) => `${(index / Math.max(points.length - 1, 1)) * 120},${40 - (point.ideal / max) * 36}`).join(' ')}
      />
      <polyline
        fill="none"
        stroke="#3e4db5"
        strokeWidth="1.5"
        points={points.map((point, index) => `${(index / Math.max(points.length - 1, 1)) * 120},${40 - (point.actual / max) * 36}`).join(' ')}
      />
    </svg>
  )
}

export function CycleForm({
  onSubmit,
  busy,
}: {
  onSubmit: (body: { name: string; description: string; startDate: string; endDate: string }) => Promise<void>
  busy: boolean
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState(isoOffset(0))
  const [endDate, setEndDate] = useState(isoOffset(13))
  return (
    <form
      className="space-y-3"
      onSubmit={(event: FormEvent) => {
        event.preventDefault()
        onSubmit({ name, description, startDate, endDate })
      }}
    >
      <TextField label="Title" data-testid="cycle-name" value={name} onChange={(event) => setName(event.target.value)} required />
      <TextArea label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Start date" data-testid="cycle-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
        <TextField label="End date" data-testid="cycle-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
      </div>
      <div className="flex justify-end">
        <Button type="submit" data-testid="cycle-submit" disabled={busy}>
          Add cycle
        </Button>
      </div>
    </form>
  )
}

export function useCycles(slug: string, projectId: string) {
  const [cycles, setCycles] = useState<CycleSummary[] | null>(null)
  const [error, setError] = useState('')
  function reload() {
    return api<{ cycles: CycleSummary[] }>(`/api/v1/workspaces/${slug}/projects/${projectId}/cycles`)
      .then((body) => setCycles(body.cycles))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load cycles'))
  }
  useEffect(() => {
    reload()
  }, [projectId, slug])
  return { cycles, error, reload, setError }
}

export function CycleList() {
  const params = useParams<{ workspaceSlug: string; projectId: string }>()
  const { cycles, error, reload, setError } = useCycles(params.workspaceSlug, params.projectId)
  const [tab, setTab] = useState<'ACTIVE' | 'UPCOMING' | 'COMPLETED'>('ACTIVE')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const shown = (cycles || []).filter((cycle) => cycle.status === tab && cycle.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
        {(['ACTIVE', 'UPCOMING', 'COMPLETED'] as const).map((item) => (
          <button key={item} type="button" data-testid={`cycle-tab-${item}`} className={`rounded-md px-3 py-1 text-sm capitalize ${tab === item ? 'bg-canvas font-medium' : ''}`} onClick={() => setTab(item)}>
            {item.toLowerCase()}
          </button>
        ))}
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" className="ml-auto h-8 rounded-md border border-line px-2 text-sm" />
        <Button data-testid="add-cycle" onClick={() => setOpen(true)}>
          Add cycle
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
      {cycles === null ? <Spinner /> : null}
      {cycles && shown.length === 0 ? <EmptyState title={`No ${tab.toLowerCase()} cycles`} body="Cycles group work items between two dates. Ranges cannot overlap." /> : null}
      <div className="grid gap-3 p-4">
        {shown.map((cycle) => (
          <Link key={cycle.id} href={`/${params.workspaceSlug}/projects/${params.projectId}/cycles/${cycle.id}`} data-testid="cycle-card" className="rounded-xl border border-line p-4 hover:border-ink/30">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">{cycle.name}</p>
                <p className="text-xs text-muted">
                  {day(cycle.startDate)} – {day(cycle.endDate)} · {cycle.progress.percent}% · {cycle.progress.completed}/{cycle.progress.total}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {cycle.progress.leadBy >= 0 ? `Leading by ${cycle.progress.leadBy}` : `Trailing by ${Math.abs(cycle.progress.leadBy)}`} work items
                </p>
              </div>
              <div className="w-40">
                <Burndown points={cycle.progress.burndown} />
              </div>
            </div>
          </Link>
        ))}
      </div>
      {open ? (
        <Modal title="Add cycle" onClose={() => setOpen(false)}>
          <CycleForm
            busy={busy}
            onSubmit={async (body) => {
              setBusy(true)
              setError('')
              try {
                await api(`/api/v1/workspaces/${params.workspaceSlug}/projects/${params.projectId}/cycles`, {
                  method: 'POST',
                  body: JSON.stringify(body),
                })
                setOpen(false)
                await reload()
              } catch (err) {
                setError(err instanceof ApiError ? err.message : 'Could not create the cycle')
              } finally {
                setBusy(false)
              }
            }}
          />
        </Modal>
      ) : null}
    </div>
  )
}
