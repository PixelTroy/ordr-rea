'use client'

import { useParams } from 'next/navigation'
import { WorkItemsBoard } from '@/components/work/work-items-board'

export default function ProjectIssuesPage() {
  const params = useParams<{ workspaceSlug: string; projectId: string }>()
  return <WorkItemsBoard slug={params.workspaceSlug} projectId={params.projectId} />
}
