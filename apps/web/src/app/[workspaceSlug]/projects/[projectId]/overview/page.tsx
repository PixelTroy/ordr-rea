'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { ProjectDetail, WorkItem } from '@/lib/work'
import { Spinner } from '@/components/ui'

const GROUPS = ['BACKLOG', 'UNSTARTED', 'STARTED', 'COMPLETED', 'CANCELLED']

export default function OverviewPage() {
  const params = useParams<{ workspaceSlug: string; projectId: string }>()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [issues, setIssues] = useState<WorkItem[]>([])

  useEffect(() => {
    Promise.all([
      api<{ project: ProjectDetail }>(`/api/v1/workspaces/${params.workspaceSlug}/projects/${params.projectId}`),
      api<{ issues: WorkItem[] }>(`/api/v1/workspaces/${params.workspaceSlug}/projects/${params.projectId}/issues`),
    ]).then(([projectBody, issueBody]) => {
      setProject(projectBody.project)
      setIssues(issueBody.issues)
    })
  }, [params.projectId, params.workspaceSlug])

  if (!project) return <Spinner />
  const total = issues.length || 1
  return (
    <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1fr_280px]">
      <div>
        <div className="h-28 rounded-xl" style={{ background: project.coverColor }} />
        <h2 className="mt-4 text-2xl font-semibold">
          {project.emoji} {project.name}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">{project.description || 'No description yet.'}</p>
        <div className="mt-6 flex h-3 overflow-hidden rounded-full bg-canvas">
          {GROUPS.map((group) => {
            const count = issues.filter((issue) => issue.state.group === group).length
            if (!count) return null
            return <div key={group} style={{ width: `${(count / total) * 100}%`, background: group === 'COMPLETED' ? '#16a34a' : group === 'STARTED' ? '#f59e0b' : '#d4d4d8' }} />
          })}
        </div>
        <ul className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
          {GROUPS.map((group) => (
            <li key={group}>
              {group.toLowerCase()} {issues.filter((issue) => issue.state.group === group).length}
            </li>
          ))}
        </ul>
      </div>
      <aside className="rounded-xl border border-line p-4 text-sm">
        <p className="text-xs font-semibold text-muted">DETAILS</p>
        <p className="mt-2">ID {project.identifier}</p>
        <p>Network {project.network === 'PUBLIC' ? 'Public' : 'Private'}</p>
        <p>Lead {project.lead?.displayName || 'No lead'}</p>
        <p>Work items {issues.length}</p>
        <p>Members {project.memberCount}</p>
      </aside>
    </div>
  )
}
