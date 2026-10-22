'use client'

import { useParams } from 'next/navigation'
import { PageList } from '@/components/collab/pages'

export default function ProjectPagesPage() {
  const params = useParams<{ projectId: string }>()
  return <PageList projectId={params.projectId} />
}
