'use client'

import { EmptyState } from '@/components/ui'

export default function ProjectsPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <h1 className="text-xl font-semibold">Projects</h1>
        <div className="flex items-center gap-2">
          <input
            disabled
            placeholder="Search"
            className="h-8 w-44 rounded-md border border-line bg-canvas px-3 text-sm"
          />
          <button
            type="button"
            disabled
            className="h-8 rounded-md border border-line px-3 text-sm text-muted"
            title="Sort arrives with projects"
          >
            Created date
          </button>
          <button type="button" disabled className="h-8 rounded-md bg-neutral-200 px-3 text-sm text-neutral-500">
            Add project
          </button>
        </div>
      </div>
      <EmptyState
        title="No projects yet"
        body="Projects group work items, cycles, modules, views, and pages. Creating a project arrives in the next milestone."
      />
    </div>
  )
}
