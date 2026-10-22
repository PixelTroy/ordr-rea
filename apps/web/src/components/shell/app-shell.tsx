'use client'

import { ReactNode, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { IconRail } from '@/components/shell/icon-rail'
import { Sidebar } from '@/components/shell/sidebar'
import { TopBar } from '@/components/shell/top-bar'
import { useWorkspace } from '@/components/shell/workspace-provider'
import { CreateIssueModal } from '@/components/work/create-issue-modal'
import { useRouter } from 'next/navigation'

export function AppShell({ children }: { children: ReactNode }) {
  const { slug } = useWorkspace()
  const path = usePathname()
  const router = useRouter()
  const settings = path.startsWith(`/${slug}/settings`)
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    const open = () => setCreateOpen(true)
    window.addEventListener('ordr:create-issue', open)
    return () => window.removeEventListener('ordr:create-issue', open)
  }, [])

  return (
    <div className="flex h-screen flex-col bg-canvas text-ink">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <IconRail slug={slug} />
        {settings ? null : <Sidebar slug={slug} />}
        <main className="min-w-0 flex-1 overflow-auto bg-white">{children}</main>
      </div>
      {createOpen ? (
        <CreateIssueModal
          slug={slug}
          seed={{}}
          onClose={() => setCreateOpen(false)}
          onCreated={(issue) => {
            const projectMatch = path.match(/\/projects\/([^/]+)/)
            if (!projectMatch) router.push(`/${slug}/browse/${issue.key}`)
            else router.refresh()
          }}
        />
      ) : null}
    </div>
  )
}
