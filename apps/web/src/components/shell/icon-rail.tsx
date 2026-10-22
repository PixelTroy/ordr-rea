'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Settings, Sparkles, SquareKanban, StickyNote } from 'lucide-react'

const items = [
  { href: (slug: string) => `/${slug}`, icon: SquareKanban, label: 'Work', match: (path: string, slug: string) => !path.startsWith(`/${slug}/wiki`) && !path.startsWith(`/${slug}/ai-chat`) && !path.startsWith(`/${slug}/settings`) },
  { href: (slug: string) => `/${slug}/wiki`, icon: BookOpen, label: 'Wiki', match: (path: string, slug: string) => path.startsWith(`/${slug}/wiki`) },
  { href: (slug: string) => `/${slug}/ai-chat`, icon: Sparkles, label: 'AI', match: (path: string, slug: string) => path.startsWith(`/${slug}/ai-chat`) },
  { href: (slug: string) => `/${slug}/settings`, icon: Settings, label: 'Settings', match: (path: string, slug: string) => path.startsWith(`/${slug}/settings`) },
]

export function IconRail({ slug }: { slug: string }) {
  const path = usePathname()
  return (
    <nav className="flex w-14 shrink-0 flex-col items-center border-r border-line bg-white py-3">
      <div className="mb-3 grid h-8 w-8 place-items-center rounded-lg bg-ink text-sm font-semibold text-white">
        O
      </div>
      <div className="flex flex-1 flex-col items-center gap-1">
        {items.map((item) => {
          const active = item.match(path, slug)
          const Icon = item.icon
          return (
            <Link
              key={item.label}
              href={item.href(slug)}
              title={item.label}
              aria-label={item.label}
              className={`grid h-9 w-9 place-items-center rounded-lg ${active ? 'bg-canvas text-ink' : 'text-muted hover:bg-canvas'}`}
            >
              <Icon size={18} />
            </Link>
          )
        })}
      </div>
      <Link
        href={`/${slug}/stickies`}
        title="Stickies"
        aria-label="Stickies"
        className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-canvas"
      >
        <StickyNote size={18} />
      </Link>
    </nav>
  )
}
