'use client'

import { EmptyState } from '@/components/ui'

export function LaterPage({ title, body }: { title: string; body: string }) {
  return <EmptyState title={title} body={body} />
}
