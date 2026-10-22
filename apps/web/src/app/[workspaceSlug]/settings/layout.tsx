'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useWorkspace } from '@/components/shell/workspace-provider'

const groups = [
  {
    label: 'Administration',
    items: [
      ['General', ''],
      ['Members', 'members'],
      ['Billing and plans', 'billing'],
      ['Imports', 'imports'],
      ['Exports', 'exports'],
      ['Worklogs', 'worklogs'],
      ['Identity', 'identity'],
      ['Workspace Governance', 'governance'],
    ],
  },
  {
    label: 'Products',
    items: [
      ['Wiki', 'wiki'],
      ['Assistant', 'assistant'],
    ],
  },
  {
    label: 'Features',
    items: [
      ['Projects', 'feature-projects'],
      ['Teamspaces', 'teamspaces'],
      ['Initiatives', 'initiatives'],
      ['Customers', 'customers'],
      ['Templates', 'templates'],
      ['Integrations', 'integrations'],
      ['Releases', 'releases'],
    ],
  },
  {
    label: 'Developers',
    items: [
      ['Webhooks', 'webhooks'],
      ['Access tokens', 'access-tokens'],
    ],
  },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { slug } = useWorkspace()
  const path = usePathname()
  if (path.includes('/settings/projects/')) return <div className="min-h-full bg-white">{children}</div>
  return (
    <div className="flex min-h-full">
      <aside className="w-60 shrink-0 border-r border-line bg-side p-4">
        <h1 className="px-2 text-lg font-semibold">Workspace settings</h1>
        <div className="mt-4 space-y-4">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-muted">{group.label}</p>
              {group.items.map(([label, section]) => {
                const href = section ? `/${slug}/settings/${section}` : `/${slug}/settings`
                const active = path === href
                return (
                  <Link
                    key={label}
                    href={href}
                    className={`block rounded-md px-2 py-1.5 text-sm ${active ? 'bg-white font-medium shadow-sm' : 'text-ink/80 hover:bg-white'}`}
                  >
                    {label}
                  </Link>
                )
              })}
            </div>
          ))}
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
