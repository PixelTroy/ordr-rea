'use client'

import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import Collaboration from '@tiptap/extension-collaboration'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import { io, Socket } from 'socket.io-client'
import * as Y from 'yjs'
import { api } from '@/lib/api'

function socketUrl() {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL
  if (typeof window === 'undefined') return 'http://localhost:4000'
  return `${window.location.protocol}//${window.location.hostname}:4000`
}

function toBase64(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

function fromBase64(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

export function PageEditor({
  slug,
  pageId,
  title,
  onTitle,
}: {
  slug: string
  pageId: string
  title: string
  onTitle: (title: string) => void
}) {
  const docRef = useRef<Y.Doc | null>(null)
  const saveTimer = useRef(0)
  if (!docRef.current) docRef.current = new Y.Doc()
  const [synced, setSynced] = useState(false)
  const [status, setStatus] = useState('Connecting…')

  useEffect(() => {
    const doc = docRef.current
    if (!doc) return
    const socket: Socket = io(socketUrl(), { withCredentials: true, auth: { pageId } })
    const onSync = (payload: string) => {
      Y.applyUpdate(doc, fromBase64(payload), 'remote')
      setSynced(true)
      setStatus('Saved')
    }
    const onUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === 'remote') return
      setStatus('Syncing…')
      socket.emit('update', { pageId, update: toBase64(update) })
      window.setTimeout(() => setStatus('Saved'), 400)
    }
    socket.on('sync', onSync)
    socket.on('update', (payload: string) => Y.applyUpdate(doc, fromBase64(payload), 'remote'))
    doc.on('update', onUpdate)
    return () => {
      socket.off('sync', onSync)
      doc.off('update', onUpdate)
      socket.disconnect()
    }
  }, [pageId])

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ history: false }),
        Collaboration.configure({ document: docRef.current }),
        Placeholder.configure({ placeholder: "Press '/' for commands" }),
      ],
      immediatelyRender: false,
      onUpdate: ({ editor: current }) => {
        const json = current.getJSON()
        window.clearTimeout(saveTimer.current)
        saveTimer.current = window.setTimeout(() => {
          api(`/api/v1/workspaces/${slug}/pages/${pageId}`, {
            method: 'PATCH',
            body: JSON.stringify({ contentJson: json }),
          }).catch(() => setStatus('Offline'))
        }, 600)
      },
    },
    [synced, pageId],
  )

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-muted">
        <span>{status}</span>
      </div>
      <input
        data-testid="page-title"
        value={title}
        onChange={(event) => onTitle(event.target.value)}
        onBlur={() => {
          api(`/api/v1/workspaces/${slug}/pages/${pageId}`, {
            method: 'PATCH',
            body: JSON.stringify({ title }),
          }).catch(() => setStatus('Could not save the title'))
        }}
        className="w-full border-0 text-3xl font-semibold outline-none"
      />
      <div className="prose-editor mt-4" data-testid="page-body">
        {synced ? <EditorContent editor={editor} /> : <p className="text-sm text-muted">Opening the page…</p>}
      </div>
    </div>
  )
}
