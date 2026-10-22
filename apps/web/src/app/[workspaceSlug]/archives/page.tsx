'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useWorkspace } from '@/components/shell/workspace-provider'
import { api } from '@/lib/api'
import { ProjectCard } from '@/lib/work'
import { EmptyState, Spinner } from '@/components/ui'

export default function ArchivesPage() {
  const { slug } = useWorkspace()
  const [projects, setProjects] = useState<ProjectCard[] | null>(null)
  useEffect(() => {
    api<{ projects: ProjectCard[] }>(`/api/v1/workspaces/${slug}/projects?archived=1`)
      .then((body) => setProjects(body.projects))
      .catch(() => setProjects([]))
  }, [slug])
  return (
    <div>
      <h1 className="border-b border-line px-6 py-4 text-xl font-semibold">Archives</h1>
      {projects === null ? <Spinner /> : null}
      {projects && projects.length === 0 ? <EmptyState title="Nothing archived" body="Archived projects show up here." /> : null}
      <ul>
        {projects?.map((project) => (
          <li key={project.id} className="border-b border-line px-6 py-3 text-sm">
            <Link href={`/${slug}/projects/${project.id}/issues`} className="font-medium hover:underline">
              {project.emoji} {project.name}
            </Link>
            <span className="ml-2 text-xs text-muted">{project.identifier}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
