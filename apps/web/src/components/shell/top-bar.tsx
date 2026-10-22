'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Check, ChevronDown, Inbox, LogOut, Plus, Search, Sparkles } from 'lucide-react'
import { COMPANY_SIZES, slugify } from '@ordr/shared'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/components/auth-provider'
import { useWorkspace } from '@/components/shell/workspace-provider'
import { Avatar, Button, ErrorText, TextField } from '@/components/ui'

export function TopBar() {
  const router = useRouter()
  const { user, logout } = useAuth()
  const { workspace, workspaces, slug } = useWorkspace()
  const [menu, setMenu] = useState<'switch' | 'user' | 'search' | 'create' | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-white px-3">
      <div className="relative">
        <button
          type="button"
          data-testid="workspace-switcher"
          onClick={() => setMenu(menu === 'switch' ? null : 'switch')}
          className="flex h-8 items-center gap-2 rounded-md px-2 text-sm font-medium hover:bg-canvas"
        >
          <span className="grid h-5 w-5 place-items-center rounded bg-accent text-[10px] text-white">
            {workspace.name.slice(0, 1).toUpperCase()}
          </span>
          {workspace.name}
          <ChevronDown size={14} className="text-muted" />
        </button>
        {menu === 'switch' ? (
          <div className="absolute left-0 top-10 z-30 w-72 rounded-xl border border-line bg-white p-2 shadow-pop">
            <p className="px-2 py-1 text-[11px] font-semibold tracking-wide text-muted">WORKSPACES</p>
            {workspaces.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-canvas"
                onClick={() => {
                  setMenu(null)
                  router.push(`/${item.slug}`)
                }}
              >
                <span className="grid h-6 w-6 place-items-center rounded bg-ink text-[11px] text-white">
                  {item.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{item.name}</span>
                  <span className="block text-xs text-muted">{item.slug}</span>
                </span>
                {item.slug === slug ? <Check size={14} /> : null}
              </button>
            ))}
            <button
              type="button"
              className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-canvas"
              onClick={() => setMenu('create')}
            >
              <Plus size={14} />
              Create workspace
            </button>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        data-testid="search-open"
        onClick={() => setMenu('search')}
        className="mx-auto flex h-8 w-full max-w-md items-center gap-2 rounded-md border border-line bg-canvas px-3 text-sm text-muted"
      >
        <Search size={14} />
        Search
      </button>

      <div className="ml-auto flex items-center gap-1">
        <Link
          href={`/${slug}/ai-chat`}
          className="hidden h-8 items-center gap-1 rounded-md px-2 text-sm text-muted hover:bg-canvas sm:inline-flex"
        >
          <Sparkles size={14} />
          AI assistant
        </Link>
        <Link
          href={`/${slug}/notifications`}
          aria-label="Inbox"
          data-testid="inbox-link"
          className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-canvas"
        >
          <Inbox size={16} />
        </Link>
        <div className="relative">
          <button
            type="button"
            data-testid="user-menu"
            aria-label="Account menu"
            onClick={() => setMenu(menu === 'user' ? null : 'user')}
            className="grid h-8 w-8 place-items-center rounded-full"
          >
            <Avatar name={user?.displayName || '?'} color={user?.avatarColor} size={28} />
          </button>
          {menu === 'user' && user ? (
            <div className="absolute right-0 top-10 z-30 w-60 rounded-xl border border-line bg-white p-2 shadow-pop">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user.displayName}</p>
                <p className="truncate text-xs text-muted">{user.email}</p>
              </div>
              <Link
                href="/settings/profile/api-tokens"
                className="block rounded-md px-2 py-1.5 text-sm hover:bg-canvas"
                onClick={() => setMenu(null)}
              >
                Personal access tokens
              </Link>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-canvas"
                onClick={async () => {
                  await logout()
                  router.replace('/login')
                }}
              >
                <LogOut size={14} />
                Log out
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {menu === 'search' ? (
        <div className="fixed inset-0 z-40 grid place-items-start bg-black/30 px-4 pt-24" onClick={() => setMenu(null)}>
          <div
            className="mx-auto w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-pop"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-line px-4">
              <Search size={16} className="text-muted" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Start typing to search across work items, projects, cycles, modules and more"
                className="h-12 w-full bg-transparent text-sm outline-none"
              />
            </div>
            <p className="px-4 py-6 text-sm text-muted">
              {query
                ? 'Search across work items, projects, cycles, modules, and pages arrives with later milestones.'
                : 'Type to search. Results will include work items, projects, cycles, modules, and pages.'}
            </p>
          </div>
        </div>
      ) : null}

      {menu === 'create' ? <CreateWorkspace onClose={() => setMenu(null)} /> : null}
    </header>
  )
}

function CreateWorkspace({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [touched, setTouched] = useState(false)
  const [companySize, setCompanySize] = useState('1-10')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      const data = await api<{ workspace: { slug: string } }>('/api/v1/workspaces', {
        method: 'POST',
        body: JSON.stringify({ name, slug, companySize }),
      })
      onClose()
      router.push(`/${data.workspace.slug}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the workspace')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 px-4" onClick={onClose}>
      <form
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-pop"
      >
        <h2 className="text-lg font-semibold">Create workspace</h2>
        <p className="mt-1 text-sm text-muted">A workspace holds projects, members, and settings.</p>
        <div className="mt-4 space-y-3">
          <TextField
            label="Workspace name"
            value={name}
            onChange={(event) => {
              const next = event.target.value
              setName(next)
              if (!touched) setSlug(slugify(next))
            }}
            required
          />
          <TextField
            label="Workspace URL"
            value={slug}
            onChange={(event) => {
              setTouched(true)
              setSlug(slugify(event.target.value))
            }}
            hint="Lowercase letters, numbers, and hyphens."
            required
          />
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Company size</span>
            <select
              className="h-9 w-full rounded-md border border-line px-3"
              value={companySize}
              onChange={(event) => setCompanySize(event.target.value)}
            >
              {COMPANY_SIZES.map((size) => (
                <option key={size}>{size}</option>
              ))}
            </select>
          </label>
          <ErrorText>{error}</ErrorText>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'Creating…' : 'Create workspace'}
          </Button>
        </div>
      </form>
    </div>
  )
}
