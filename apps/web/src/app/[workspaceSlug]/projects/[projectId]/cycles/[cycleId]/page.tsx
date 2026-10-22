'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { WorkItem } from '@/lib/work'
import { Burndown, CycleSummary, day } from '@/components/planning/cycles'
import { CreateIssueModal } from '@/components/work/create-issue-modal'
import { Button, EmptyState, Modal, Spinner } from '@/components/ui'

export default function CycleDetailPage() {
  const params = useParams<{ workspaceSlug: string; projectId: string; cycleId: string }>()
  const [cycle, setCycle] = useState<CycleSummary | null>(null)
  const [panel, setPanel] = useState<'states' | 'assignees' | 'labels'>('states')
  const [adding, setAdding] = useState(false)
  const [existing, setExisting] = useState(false)
  const [candidates, setCandidates] = useState<WorkItem[]>([])
  const [picked, setPicked] = useState<string[]>([])

  function load() {
    return api<{ cycle: CycleSummary }>(
      `/api/v1/workspaces/${params.workspaceSlug}/projects/${params.projectId}/cycles/${params.cycleId}`,
    ).then((body) => setCycle(body.cycle))
  }

  useEffect(() => {
    load().catch(() => setCycle(null))
  }, [params.cycleId, params.projectId, params.workspaceSlug])

  if (!cycle) return <Spinner />
  const issues = cycle.issues || []
  return (
    <div className="grid h-full min-h-0 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <p className="text-sm">
            <Link href={`/${params.workspaceSlug}/projects/${params.projectId}/cycles`} className="text-muted">
              Cycles
            </Link>{' '}
            / <span className="font-medium">{cycle.name}</span>
            <span className="ml-2 rounded bg-canvas px-1.5 text-xs">{issues.length}</span>
          </p>
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" data-testid="add-existing" onClick={() => {
              setExisting(true)
              api<{ issues: WorkItem[] }>(`/api/v1/workspaces/${params.workspaceSlug}/projects/${params.projectId}/issues`).then((body) => {
                const taken = new Set(issues.map((issue) => issue.id))
                setCandidates(body.issues.filter((issue) => !taken.has(issue.id)))
              })
            }}>
              Add existing
            </Button>
            <Button data-testid="cycle-add-issue" onClick={() => setAdding(true)}>
              Add work item
            </Button>
          </div>
        </div>
        {issues.length === 0 ? (
          <EmptyState title="No work items in this cycle" body="Create a work item or add ones that already exist in the project." />
        ) : (
          <ul>
            {issues.map((issue) => (
              <li key={issue.id} className="flex items-center gap-3 border-b border-line px-4 py-2 text-sm" data-testid="cycle-issue">
                <Link href={`/${params.workspaceSlug}/browse/${issue.key}`} className="min-w-0 flex-1 truncate">
                  <span className="mr-2 text-xs text-muted">{issue.key}</span>
                  {issue.title}
                </Link>
                <span className="text-xs text-muted">{issue.state.name}</span>
                <span className="text-xs">{issue.priority}</span>
                {issue.labels.slice(0, 2).map((label) => (
                  <span key={label.name} className="rounded px-1.5 text-[11px] text-white" style={{ background: label.color }}>
                    {label.name}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        )}
      </div>
      <aside className="border-l border-line bg-side p-4 text-sm">
        <h2 className="font-semibold">{cycle.name}</h2>
        <p className="mt-1 text-xs text-muted">
          {day(cycle.startDate)} – {day(cycle.endDate)}
        </p>
        <span className="mt-2 inline-block rounded bg-white px-2 py-0.5 text-xs">{cycle.status}</span>
        <p className="mt-3 text-xs text-muted">{cycle.description}</p>
        <p className="mt-4 text-xs font-semibold text-muted">PROPERTIES</p>
        <p className="mt-2">Lead {cycle.lead?.displayName || 'None'}</p>
        <p>Members {cycle.members.length}</p>
        <p>
          Work items {cycle.progress.completed}/{cycle.progress.total}
        </p>
        <p className="mt-2 text-xs">
          {cycle.progress.leadBy >= 0 ? `Leading by ${cycle.progress.leadBy}` : `Trailing by ${Math.abs(cycle.progress.leadBy)}`}
        </p>
        <Burndown points={cycle.progress.burndown} />
        <div className="mt-3 flex gap-2 text-xs">
          {(['states', 'assignees', 'labels'] as const).map((item) => (
            <button key={item} type="button" className={panel === item ? 'font-semibold' : 'text-muted'} onClick={() => setPanel(item)}>
              {item}
            </button>
          ))}
        </div>
        {panel === 'states' ? (
          <ul className="mt-2 text-xs">
            {cycle.progress.byGroup.map((row) => (
              <li key={row.group}>
                {row.group.toLowerCase()} {row.count}
              </li>
            ))}
          </ul>
        ) : null}
        {panel === 'assignees' ? (
          <ul className="mt-2 text-xs">
            {cycle.progress.assignees.map((row) => (
              <li key={row.id}>
                {row.name} {row.count}
              </li>
            ))}
          </ul>
        ) : null}
        {panel === 'labels' ? (
          <ul className="mt-2 text-xs">
            {cycle.progress.labels.map((row) => (
              <li key={row.name}>
                {row.name} {row.count}
              </li>
            ))}
          </ul>
        ) : null}
      </aside>
      {adding ? (
        <CreateIssueModal
          slug={params.workspaceSlug}
          seed={{ projectId: params.projectId, cycleId: params.cycleId }}
          onClose={() => setAdding(false)}
          onCreated={() => load()}
        />
      ) : null}
      {existing ? (
        <Modal title="Add existing work item" onClose={() => setExisting(false)}>
          <ul className="max-h-64 space-y-1 overflow-auto text-sm">
            {candidates.map((issue) => (
              <li key={issue.id}>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={picked.includes(issue.id)}
                    onChange={(event) =>
                      setPicked((current) => (event.target.checked ? [...current, issue.id] : current.filter((id) => id !== issue.id)))
                    }
                  />
                  {issue.key} {issue.title}
                </label>
              </li>
            ))}
          </ul>
          <Button
            className="mt-3"
            data-testid="add-selected"
            disabled={picked.length === 0}
            onClick={async () => {
              await api(`/api/v1/workspaces/${params.workspaceSlug}/projects/${params.projectId}/cycles/${params.cycleId}/issues`, {
                method: 'POST',
                body: JSON.stringify({ issueIds: picked }),
              })
              setPicked([])
              setExisting(false)
              await load()
            }}
          >
            Add selected work items
          </Button>
        </Modal>
      ) : null}
    </div>
  )
}
