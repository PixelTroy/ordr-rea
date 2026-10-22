'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { MODULE_STATUSES } from '@ordr/shared'
import { ApiError, api } from '@/lib/api'
import { Button, EmptyState, ErrorText, Modal, Spinner, TextArea, TextField } from '@/components/ui'
import { day, isoOffset } from '@/components/planning/cycles'

type ModuleRow = {
  id: string
  name: string
  description?: string
  status: string
  startDate: string | null
  targetDate: string | null
  lead: { displayName: string } | null
  members: Array<{ displayName: string }>
  progress: { total: number; completed: number; percent: number }
  issues?: Array<{ id: string; key: string; title: string; state: { name: string } }>
}

export function ModuleBoard() {
  const params = useParams<{ workspaceSlug: string; projectId: string }>()
  const [modules, setModules] = useState<ModuleRow[] | null>(null)
  const [layout, setLayout] = useState<'list' | 'gantt'>('list')
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  function load() {
    api<{ modules: ModuleRow[] }>(`/api/v1/workspaces/${params.workspaceSlug}/projects/${params.projectId}/modules`)
      .then((body) => setModules(body.modules))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load modules'))
  }
  useEffect(() => {
    load()
  }, [params.projectId, params.workspaceSlug])

  const shown = (modules || []).filter((module) => module.name.toLowerCase().includes(search.toLowerCase()))
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" className="h-8 rounded-md border border-line px-2 text-sm" />
        <button type="button" className={`rounded-md px-2 py-1 text-sm ${layout === 'list' ? 'bg-canvas' : ''}`} onClick={() => setLayout('list')}>
          List
        </button>
        <button type="button" data-testid="module-gantt" className={`rounded-md px-2 py-1 text-sm ${layout === 'gantt' ? 'bg-canvas' : ''}`} onClick={() => setLayout('gantt')}>
          Gantt
        </button>
        <Button className="ml-auto" data-testid="add-module" onClick={() => setOpen(true)}>
          Add module
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
      {modules === null ? <Spinner /> : null}
      {modules && shown.length === 0 ? <EmptyState title="No modules" body="Modules group work items that can span more than one cycle." /> : null}
      {layout === 'list' ? (
        <ul>
          {shown.map((module) => (
            <li key={module.id} className="border-b border-line">
              <Link href={`/${params.workspaceSlug}/projects/${params.projectId}/modules/${module.id}`} data-testid="module-row" className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="flex-1 font-medium">{module.name}</span>
                <span className="text-xs text-muted">{module.status}</span>
                <span className="text-xs">
                  {module.progress.completed}/{module.progress.total}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-2 p-4">
          {shown.map((module) => (
            <div key={module.id} className="grid grid-cols-[220px_1fr] items-center gap-3 text-sm">
              <Link href={`/${params.workspaceSlug}/projects/${params.projectId}/modules/${module.id}`} className="truncate">
                {module.name}
              </Link>
              <div className="relative h-6 rounded bg-canvas">
                <div className="absolute top-1 h-4 rounded bg-accent/80" style={{ left: '8%', width: module.startDate ? '35%' : '8%' }} />
              </div>
            </div>
          ))}
        </div>
      )}
      {open ? (
        <Modal title="Add module" onClose={() => setOpen(false)}>
          <ModuleForm
            onSubmit={async (body) => {
              await api(`/api/v1/workspaces/${params.workspaceSlug}/projects/${params.projectId}/modules`, {
                method: 'POST',
                body: JSON.stringify(body),
              })
              setOpen(false)
              load()
            }}
            onError={setError}
          />
        </Modal>
      ) : null}
    </div>
  )
}

function ModuleForm({
  onSubmit,
  onError,
}: {
  onSubmit: (body: Record<string, string>) => Promise<void>
  onError: (message: string) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<(typeof MODULE_STATUSES)[number]>('PLANNED')
  const [startDate, setStartDate] = useState(isoOffset(0))
  const [targetDate, setEndDate] = useState(isoOffset(20))
  return (
    <form
      className="space-y-3"
      onSubmit={async (event: FormEvent) => {
        event.preventDefault()
        try {
          await onSubmit({ name, description, status, startDate, targetDate })
        } catch (err) {
          onError(err instanceof ApiError ? err.message : 'Could not create the module')
        }
      }}
    >
      <TextField label="Title" data-testid="module-name" value={name} onChange={(event) => setName(event.target.value)} required />
      <TextArea label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
      <label className="block text-sm">
        Status
        <select className="mt-1 h-9 w-full rounded-md border border-line px-2" value={status} onChange={(event) => setStatus(event.target.value as (typeof MODULE_STATUSES)[number])}>
          {MODULE_STATUSES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Start date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        <TextField label="End date" type="date" value={targetDate} onChange={(event) => setEndDate(event.target.value)} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" data-testid="module-submit">
          Add module
        </Button>
      </div>
    </form>
  )
}

export function ModuleDetail() {
  const params = useParams<{ workspaceSlug: string; projectId: string; moduleId: string }>()
  const [module, setModule] = useState<ModuleRow | null>(null)
  useEffect(() => {
    api<{ module: ModuleRow }>(`/api/v1/workspaces/${params.workspaceSlug}/projects/${params.projectId}/modules/${params.moduleId}`)
      .then((body) => setModule(body.module))
      .catch(() => setModule(null))
  }, [params.moduleId, params.projectId, params.workspaceSlug])
  if (!module) return <Spinner />
  return (
    <div className="px-4 py-4">
      <p className="text-sm text-muted">
        <Link href={`/${params.workspaceSlug}/projects/${params.projectId}/modules`}>Modules</Link> / {module.name}
      </p>
      <h2 className="mt-2 text-xl font-semibold">{module.name}</h2>
      <p className="text-sm text-muted">
        {module.status}
        {module.startDate ? ` · ${day(module.startDate)}` : ''}
        {module.targetDate ? ` – ${day(module.targetDate)}` : ''} · Lead {module.lead?.displayName || 'None'}
      </p>
      <p className="mt-2 text-sm">{module.description}</p>
      <ul className="mt-4">
        {(module.issues || []).map((issue) => (
          <li key={issue.id} className="border-t border-line py-2 text-sm">
            <Link href={`/${params.workspaceSlug}/browse/${issue.key}`}>
              <span className="mr-2 text-xs text-muted">{issue.key}</span>
              {issue.title}
            </Link>
            <span className="ml-2 text-xs text-muted">{issue.state.name}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
