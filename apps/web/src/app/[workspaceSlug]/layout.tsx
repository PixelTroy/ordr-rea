'use client'

import { useParams } from 'next/navigation'
import { AppShell } from '@/components/shell/app-shell'
import { WorkspaceProvider } from '@/components/shell/workspace-provider'

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ workspaceSlug: string }>()
  return (
    <WorkspaceProvider slug={params.workspaceSlug}>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  )
}
