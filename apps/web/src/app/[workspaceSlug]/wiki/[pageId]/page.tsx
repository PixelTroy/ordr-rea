'use client'

import { useParams } from 'next/navigation'
import { PageScreen } from '@/components/collab/pages'

export default function WikiEditorPage() {
  const params = useParams<{ pageId: string }>()
  return <PageScreen pageId={params.pageId} />
}
