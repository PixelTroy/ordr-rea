'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Archive,
  BarChart3,
  FilePenLine,
  GalleryHorizontal,
  Home,
  Layers,
  LayoutDashboard,
  Plus,
  RefreshCw,
  StickyNote,
  UserRound,
} from 'lucide-react'
import { ReactNode } from 'react'

function Item({
  href,
  icon,
  children,
  exact = false,
}: {
  href: string
  icon: ReactNode
  children: ReactNode
  exact?: boolean
}) {
  const path = usePathname()
  const active = exact ? path === href : path === href || path.startsWith(`${href}/`)
  return (
    <Link
      href={href}
      className={`flex h-8 items-center gap-2 rounded-md px-2 text-[13px] ${active ? 'bg-black/5 font-medium text-ink' : 'text-ink/80 hover:bg-black/5'}`}
    >
      <span className="text-muted">{icon}</span>
      {children}
    </Link>
  )
}

export function Sidebar({ slug }: { slug: string }) {
  const router = useRouter()
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-side">
      <div className="p-3">
        <button
          type="button"
          onClick={() => router.push(`/${slug}/projects`)}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-ink text-sm font-medium text-white hover:bg-black"
        >
          <Plus size={15} />
          New work item
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-auto px-2 pb-4">
        <div className="space-y-0.5">
          <Item href={`/${slug}`} icon={<Home size={15} />} exact>
            Home
          </Item>
          <Item href={`/${slug}/drafts`} icon={<FilePenLine size={15} />}>
            Drafts
          </Item>
          <Item href={`/${slug}/your-work`} icon={<UserRound size={15} />}>
            Your work
          </Item>
          <Item href={`/${slug}/stickies`} icon={<StickyNote size={15} />}>
            Stickies
          </Item>
        </div>
        <div>
          <p className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-muted">WORKSPACE</p>
          <div className="space-y-0.5">
            <Item href={`/${slug}/projects`} icon={<Layers size={15} />}>
              Projects
            </Item>
            <Item href={`/${slug}/workspace-views/all-issues`} icon={<GalleryHorizontal size={15} />}>
              Views
            </Item>
            <Item href={`/${slug}/active-cycles`} icon={<RefreshCw size={15} />}>
              Cycles
            </Item>
            <Item href={`/${slug}/analytics`} icon={<BarChart3 size={15} />}>
              Analytics
            </Item>
            <Item href={`/${slug}/archives`} icon={<Archive size={15} />}>
              Archives
            </Item>
            <Item href={`/${slug}/dashboards`} icon={<LayoutDashboard size={15} />}>
              Dashboards
            </Item>
          </div>
        </div>
        <div>
          <p className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-muted">PROJECTS</p>
          <p className="px-2 text-xs text-muted">No projects yet</p>
        </div>
      </div>
    </aside>
  )
}
