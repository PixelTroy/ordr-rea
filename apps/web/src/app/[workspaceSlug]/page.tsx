'use client'

import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { useWorkspace } from '@/components/shell/workspace-provider'

export default function WorkspaceHomePage() {
  const { user } = useAuth()
  const { workspace, slug } = useWorkspace()
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const date = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <p className="text-sm text-muted">{date}</p>
      <h1 className="mt-1 text-2xl font-semibold">
        {greeting}, {user?.displayName}
      </h1>
      <p className="mt-1 text-sm text-muted">{workspace.name}</p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Widget title="Quick links" action="Add quick link">
          <p className="text-sm text-muted">Pin a project, view, or page. Quick links arrive with projects.</p>
        </Widget>
        <Widget title="Recents" action="All">
          <p className="text-sm text-muted">Work items, pages, and projects you open will show up here.</p>
          <Link href={`/${slug}/projects`} className="mt-3 inline-block text-sm font-medium underline">
            Browse projects
          </Link>
        </Widget>
        <Widget title="Your stickies" action="Add sticky">
          <p className="text-sm text-muted">Personal notes for this workspace are on the roadmap.</p>
        </Widget>
      </div>
    </div>
  )
}

function Widget({ title, action, children }: { title: string; action: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-muted">{action}</span>
      </div>
      {children}
    </section>
  )
}
