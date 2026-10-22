'use client'

import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { IconRail } from '@/components/shell/icon-rail'
import { Sidebar } from '@/components/shell/sidebar'
import { TopBar } from '@/components/shell/top-bar'
import { useWorkspace } from '@/components/shell/workspace-provider'

export function AppShell({ children }: { children: ReactNode }) {
  const { slug } = useWorkspace()
  const path = usePathname()
  const settings = path.startsWith(`/${slug}/settings`)
  return (
    <div className="flex h-screen flex-col bg-canvas text-ink">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <IconRail slug={slug} />
        {settings ? null : <Sidebar slug={slug} />}
        <main className="min-w-0 flex-1 overflow-auto bg-white">{children}</main>
      </div>
    </div>
  )
}
