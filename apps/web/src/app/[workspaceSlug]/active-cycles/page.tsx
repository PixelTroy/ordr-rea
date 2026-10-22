'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useWorkspace } from '@/components/shell/workspace-provider'
import { api } from '@/lib/api'
import { Burndown, CycleSummary, day } from '@/components/planning/cycles'
import { EmptyState, Spinner } from '@/components/ui'

type Active = CycleSummary & { project: { id: string; name: string; identifier: string } }

export default function ActiveCyclesPage() {
  const { slug } = useWorkspace()
  const [cycles, setCycles] = useState<Active[] | null>(null)
  useEffect(() => {
    api<{ cycles: Active[] }>(`/api/v1/workspaces/${slug}/active-cycles`)
      .then((body) => setCycles(body.cycles))
      .catch(() => setCycles([]))
  }, [slug])
  return (
    <div>
      <h1 className="border-b border-line px-6 py-4 text-xl font-semibold">Active cycles</h1>
      {cycles === null ? <Spinner /> : null}
      {cycles && cycles.length === 0 ? <EmptyState title="No active cycles" body="A cycle is active when today falls between its start and end dates." /> : null}
      <div className="grid gap-4 p-6">
        {cycles?.map((cycle) => (
          <Link key={cycle.id} href={`/${slug}/projects/${cycle.project.id}/cycles/${cycle.id}`} className="rounded-xl border border-line p-4">
            <p className="text-xs text-muted">{cycle.project.identifier} · {cycle.project.name}</p>
            <p className="font-medium">{cycle.name}</p>
            <p className="text-xs text-muted">
              {day(cycle.startDate)} – {day(cycle.endDate)} · {cycle.progress.percent}% ·{' '}
              {cycle.progress.leadBy >= 0 ? `Leading by ${cycle.progress.leadBy}` : `Trailing by ${Math.abs(cycle.progress.leadBy)}`}
            </p>
            <div className="mt-2 w-56">
              <Burndown points={cycle.progress.burndown} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
