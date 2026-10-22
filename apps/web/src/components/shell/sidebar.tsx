'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Archive,
  BarChart3,
  ChevronDown,
  ChevronRight,
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
import { api } from '@/lib/api'
import { ProjectCard } from '@/lib/work'

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
  const [projects, setProjects] = useState<ProjectCard[]>([])
  const [open, setOpen] = useState<Record<string, boolean>>({})

  useEffect(() => {
    api<{ projects: ProjectCard[] }>(`/api/v1/workspaces/${slug}/projects`)
      .then((body) => setProjects(body.projects))
      .catch(() => setProjects([]))
  }, [slug])

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-side">
      <div className="p-3">
        <button
          type="button"
          data-testid="new-work-item"
          onClick={() => {
            if (projects.length === 0) {
              router.push(`/${slug}/projects`)
              return
            }
            window.dispatchEvent(new CustomEvent('ordr:create-issue'))
          }}
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
          {projects.length === 0 ? <p className="px-2 text-xs text-muted">No projects yet</p> : null}
          {projects.map((project) => {
            const expanded = open[project.id]
            const base = `/${slug}/projects/${project.id}`
            return (
              <div key={project.id}>
                <button
                  type="button"
                  className="flex h-8 w-full items-center gap-1 rounded-md px-2 text-left text-[13px] hover:bg-black/5"
                  onClick={() => setOpen((current) => ({ ...current, [project.id]: !current[project.id] }))}
                >
                  {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span className="truncate">
                    {project.emoji} {project.name}
                  </span>
                </button>
                {expanded ? (
                  <div className="ml-4 space-y-0.5">
                    <Item href={`${base}/issues`} icon={<Layers size={14} />}>
                      Work items
                    </Item>
                    <Item href={`${base}/cycles`} icon={<RefreshCw size={14} />}>
                      Cycles
                    </Item>
                    <Item href={`${base}/modules`} icon={<Layers size={14} />}>
                      Modules
                    </Item>
                    <Item href={`${base}/views`} icon={<GalleryHorizontal size={14} />}>
                      Views
                    </Item>
                    <Item href={`${base}/pages`} icon={<FilePenLine size={14} />}>
                      Pages
                    </Item>
                    <Item href={`${base}/intake`} icon={<Archive size={14} />}>
                      Intake
                    </Item>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
