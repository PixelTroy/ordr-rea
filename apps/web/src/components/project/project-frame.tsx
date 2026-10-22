'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { ProjectDetail } from '@/lib/work'

const TABS = [
  ['overview', 'Overview'],
  ['issues', 'Work items'],
  ['cycles', 'Cycles'],
  ['modules', 'Modules'],
  ['views', 'Views'],
  ['pages', 'Pages'],
  ['intake', 'Intake'],
] as const

export function ProjectFrame({ children }: { children: React.ReactNode }) {
  const params = useParams<{ workspaceSlug: string; projectId: string }>()
  const path = usePathname()
  const [project, setProject] = useState<ProjectDetail | null>(null)

  useEffect(() => {
    api<{ project: ProjectDetail }>(`/api/v1/workspaces/${params.workspaceSlug}/projects/${params.projectId}`)
      .then((body) => setProject(body.project))
      .catch(() => setProject(null))
  }, [params.projectId, params.workspaceSlug])

  const base = `/${params.workspaceSlug}/projects/${params.projectId}`
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line px-6 pt-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">{project?.emoji || '📁'}</span>
          <h1 className="text-lg font-semibold">{project?.name || 'Project'}</h1>
          {project ? <span className="text-xs text-muted">{project.identifier}</span> : null}
          <Link href={`/${params.workspaceSlug}/settings/projects/${params.projectId}`} className="ml-auto text-xs text-muted hover:text-ink">
            Settings
          </Link>
        </div>
        <nav className="mt-3 flex gap-1 overflow-auto text-sm">
          {TABS.map(([segment, label]) => {
            const href = `${base}/${segment}`
            const active = path === href || path.startsWith(`${href}/`)
            return (
              <Link
                key={segment}
                href={href}
                data-testid={`tab-${segment}`}
                className={`border-b-2 px-3 py-2 ${active ? 'border-ink font-medium' : 'border-transparent text-muted hover:text-ink'}`}
              >
                {label}
              </Link>
            )
          })}
        </nav>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}
