'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { WorkItem } from '@/lib/work'
import { EmptyState, Spinner } from '@/components/ui'

export function WorkListPage({
  slug,
  title,
  query,
  empty,
}: {
  slug: string
  title: string
  query: string
  empty: string
}) {
  const [issues, setIssues] = useState<WorkItem[] | null>(null)
  useEffect(() => {
    api<{ issues: WorkItem[] }>(`/api/v1/workspaces/${slug}/work-items?${query}`)
      .then((body) => setIssues(body.issues))
      .catch(() => setIssues([]))
  }, [query, slug])
  return (
    <div>
      <h1 className="border-b border-line px-6 py-4 text-xl font-semibold">{title}</h1>
      {issues === null ? <Spinner /> : null}
      {issues && issues.length === 0 ? <EmptyState title={title} body={empty} /> : null}
      <ul>
        {issues?.map((issue) => (
          <li key={issue.id} className="border-b border-line">
            <Link href={`/${slug}/browse/${issue.key}`} className="flex items-center gap-3 px-6 py-3 text-sm hover:bg-canvas">
              <span className="w-24 text-xs text-muted">{issue.key}</span>
              <span className="flex-1 font-medium">{issue.title}</span>
              <span className="text-xs text-muted">{issue.projectName}</span>
              <span className="text-xs">{issue.state.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
