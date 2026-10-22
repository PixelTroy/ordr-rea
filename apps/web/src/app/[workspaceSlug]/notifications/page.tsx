'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useWorkspace } from '@/components/shell/workspace-provider'
import { api } from '@/lib/api'
import { Button, EmptyState, Spinner } from '@/components/ui'

type Note = {
  id: string
  type: string
  title: string
  body: string
  href: string
  readAt: string | null
  createdAt: string
  actor: { displayName: string } | null
}

export default function NotificationsPage() {
  const { slug } = useWorkspace()
  const [tab, setTab] = useState<'all' | 'mentions'>('all')
  const [notes, setNotes] = useState<Note[] | null>(null)

  function load() {
    api<{ notifications: Note[] }>(`/api/v1/workspaces/${slug}/notifications${tab === 'mentions' ? '?mentions=1' : ''}`)
      .then((body) => setNotes(body.notifications))
      .catch(() => setNotes([]))
  }

  useEffect(() => {
    load()
  }, [slug, tab])

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-line px-6 py-4">
        <h1 className="text-xl font-semibold">Inbox</h1>
        <button type="button" className={`rounded-md px-3 py-1 text-sm ${tab === 'all' ? 'bg-canvas' : ''}`} onClick={() => setTab('all')}>
          All
        </button>
        <button type="button" data-testid="mentions-tab" className={`rounded-md px-3 py-1 text-sm ${tab === 'mentions' ? 'bg-canvas' : ''}`} onClick={() => setTab('mentions')}>
          Mentions
        </button>
        <Button
          className="ml-auto"
          variant="secondary"
          onClick={async () => {
            await api(`/api/v1/workspaces/${slug}/notifications/read`, { method: 'POST', body: JSON.stringify({ all: true }) })
            load()
          }}
        >
          Mark all read
        </Button>
      </div>
      {notes === null ? <Spinner /> : null}
      {notes && notes.length === 0 ? <EmptyState title="Inbox is clear" body="Mentions, assignments, and comments show up here." /> : null}
      <ul>
        {notes?.map((note) => (
          <li key={note.id} className={`border-b border-line ${note.readAt ? 'opacity-60' : ''}`}>
            <Link
              href={note.href}
              data-testid="notification"
              className="block px-6 py-3 text-sm"
              onClick={() => {
                api(`/api/v1/workspaces/${slug}/notifications/read`, { method: 'POST', body: JSON.stringify({ ids: [note.id] }) })
              }}
            >
              <p className="font-medium">{note.title}</p>
              {note.body ? <p className="text-muted">{note.body}</p> : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
