'use client'

import { useState } from 'react'
import { ApiError, api } from '@/lib/api'
import { Button, ErrorText } from '@/components/ui'
import { useWorkspace } from '@/components/shell/workspace-provider'

export default function ExportsPage() {
  const { slug } = useWorkspace()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function download() {
    setPending(true)
    setError('')
    try {
      const data = await api<unknown>(`/api/v1/workspaces/${slug}/export`)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${slug}-export.json`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not export')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <h2 className="text-xl font-semibold">Exports</h2>
      <p className="mt-2 text-sm text-muted">
        Download the projects you can see as JSON: name, identifier, states, labels, and work items.
      </p>
      <Button className="mt-6" data-testid="export-download" onClick={download} disabled={pending}>
        {pending ? 'Exporting…' : 'Export JSON'}
      </Button>
      <ErrorText>{error}</ErrorText>
    </div>
  )
}
