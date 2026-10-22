'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { WorkItem } from '@/lib/work'
import { EmptyState, Spinner } from '@/components/ui'
import { useWorkspace } from '@/components/shell/workspace-provider'

type Row = WorkItem & { projectId?: string; projectName?: string }

export default function AllIssuesPage() {
  const { slug } = useWorkspace()
  const [issues, setIssues] = useState<Row[] | null>(null)

  useEffect(() => {
    api<{ issues: Row[] }>(`/api/v1/workspaces/${slug}/work-items`)
      .then((body) => setIssues(body.issues))
      .catch(() => setIssues([]))
  }, [slug])

  if (!issues) return <Spinner />

  return (
    <div className="px-6 py-5">
      <h1 className="text-lg font-semibold">All work items</h1>
      <p className="mt-1 text-sm text-muted">Every open work item you can see in this workspace.</p>
      {issues.length === 0 ? (
        <EmptyState title="No work items" body="Create a work item inside a project and it will show up here." />
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
          {issues.map((issue) => (
            <li key={issue.id}>
              <Link href={`/${slug}/browse/${issue.key}`} data-testid="workspace-issue" className="flex items-center gap-3 px-4 py-3 hover:bg-canvas">
                <span className="w-24 shrink-0 text-xs text-muted">{issue.key}</span>
                <span className="min-w-0 flex-1 truncate">{issue.title}</span>
                <span className="text-xs text-muted">{issue.projectName}</span>
                <span className="text-xs" style={{ color: issue.state.color }}>
                  {issue.state.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
