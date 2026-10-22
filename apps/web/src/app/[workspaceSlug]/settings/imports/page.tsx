'use client'

import { FormEvent, useState } from 'react'
import { ApiError, api } from '@/lib/api'
import { Button, ErrorText } from '@/components/ui'
import { useWorkspace } from '@/components/shell/workspace-provider'

const sample = `{
  "projects": [
    {
      "name": "Imported",
      "identifier": "IMP",
      "issues": [{ "title": "First imported item", "priority": "HIGH", "stateName": "Backlog" }]
    }
  ]
}`

export default function ImportsPage() {
  const { slug } = useWorkspace()
  const [text, setText] = useState(sample)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    setMessage('')
    try {
      const body = JSON.parse(text) as unknown
      const result = await api<{ projects: number; issues: number }>(`/api/v1/workspaces/${slug}/import`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setMessage(`Imported ${result.projects} projects and ${result.issues} work items.`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof SyntaxError ? 'That is not valid JSON' : 'Could not import')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <h2 className="text-xl font-semibold">Imports</h2>
      <p className="mt-2 text-sm text-muted">
        Paste a workspace export. Admins can create projects, states, labels, and work items from that JSON. Only admins can import.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <textarea
          data-testid="import-json"
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="min-h-64 w-full rounded-md border border-line p-3 font-mono text-xs"
        />
        <Button type="submit" data-testid="import-submit" disabled={pending}>
          {pending ? 'Importing…' : 'Import JSON'}
        </Button>
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        <ErrorText>{error}</ErrorText>
      </form>
    </div>
  )
}
