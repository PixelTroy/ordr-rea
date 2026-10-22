'use client'

import { useWorkspace } from '@/components/shell/workspace-provider'
import { WorkListPage } from '@/components/work/work-list-page'

export default function DraftsPage() {
  const { slug } = useWorkspace()
  return <WorkListPage slug={slug} title="Drafts" query="drafts=1" empty="Draft work items you create will collect here." />
}
