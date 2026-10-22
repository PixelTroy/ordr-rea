'use client'

import { useWorkspace } from '@/components/shell/workspace-provider'
import { WorkListPage } from '@/components/work/work-list-page'

export default function YourWorkPage() {
  const { slug } = useWorkspace()
  return (
    <WorkListPage
      slug={slug}
      title="Your work"
      query="mine=1"
      empty="Work items assigned to you will collect here."
    />
  )
}
