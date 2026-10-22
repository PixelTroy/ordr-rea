'use client'

import { useParams } from 'next/navigation'

const copy: Record<string, string> = {
  drafts: 'Draft work items will collect here.',
  'your-work': 'Work items assigned to you will collect here.',
  stickies: 'Personal stickies for this workspace will collect here.',
  'active-cycles': 'Active cycles across projects will show burn-down and progress here.',
  analytics: 'Workspace analytics will summarize state groups and throughput.',
  archives: 'Archived projects and work items will be listed here.',
  dashboards: 'Dashboards are not part of this version.',
  notifications: 'Inbox for mentions and assignments will live here.',
  wiki: 'Workspace pages will live in the wiki.',
  'ai-chat': 'There is no assistant in Ordr.',
}

export default function RoadmapPage() {
  const params = useParams<{ rest: string[] }>()
  const rest = params.rest || []
  const key = rest[0] || 'page'
  const title = rest.join(' / ').replaceAll('-', ' ')
  return (
    <div className="px-10 py-10">
      <p className="text-xs font-semibold tracking-wide text-muted">COMING UP</p>
      <h1 className="mt-2 text-2xl font-semibold capitalize">{title}</h1>
      <p className="mt-2 max-w-lg text-sm text-muted">
        {copy[key] || 'This screen is part of the navigation map and will be filled in by a later milestone.'}
      </p>
    </div>
  )
}
