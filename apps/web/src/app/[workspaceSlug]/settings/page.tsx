'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { COMPANY_SIZES, TIMEZONES, slugify } from '@ordr/shared'
import { useWorkspace } from '@/components/shell/workspace-provider'
import { Button, ErrorText, SelectField, TextArea, TextField } from '@/components/ui'
import { api, ApiError } from '@/lib/api'

export default function GeneralSettingsPage() {
  const router = useRouter()
  const { workspace, membership, reload } = useWorkspace()
  const admin = membership.isOwner || membership.role === 'ADMIN'
  const [name, setName] = useState(workspace.name)
  const [slug, setSlug] = useState(workspace.slug)
  const [description, setDescription] = useState(workspace.description)
  const [companySize, setCompanySize] = useState(workspace.companySize || '1-10')
  const [timezone, setTimezone] = useState(workspace.timezone || 'UTC')
  const [confirmSlug, setConfirmSlug] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function save(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    setMessage('')
    try {
      const data = await api<{ workspace: { slug: string } }>(`/api/v1/workspaces/${workspace.slug}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, slug, description, companySize, timezone }),
      })
      setMessage('Workspace updated')
      if (data.workspace.slug !== workspace.slug) router.replace(`/${data.workspace.slug}/settings`)
      else await reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the workspace')
    } finally {
      setPending(false)
    }
  }

  async function remove() {
    setError('')
    try {
      await api(`/api/v1/workspaces/${workspace.slug}`, {
        method: 'DELETE',
        body: JSON.stringify({ confirmSlug }),
      })
      router.replace('/create-workspace')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete the workspace')
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-8">
      <h2 className="text-xl font-semibold">General</h2>
      <p className="mt-1 text-sm text-muted">Name, URL, company size, and timezone.</p>
      <form onSubmit={save} className="mt-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="grid h-14 w-14 place-items-center rounded-xl bg-accent text-xl font-semibold text-white">
            {name.slice(0, 1).toUpperCase() || 'W'}
          </span>
          <p className="text-sm text-muted">A letter mark stands in for a logo upload.</p>
        </div>
        <TextField label="Workspace name" value={name} onChange={(event) => setName(event.target.value)} disabled={!admin} required />
        <TextField
          label="Workspace URL"
          value={slug}
          onChange={(event) => setSlug(slugify(event.target.value))}
          disabled={!admin}
          required
        />
        <TextArea
          label="Description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={!admin}
        />
        <SelectField label="Company size" value={companySize} onChange={(event) => setCompanySize(event.target.value)} disabled={!admin}>
          {companySize && !COMPANY_SIZES.includes(companySize as (typeof COMPANY_SIZES)[number]) ? (
            <option value={companySize}>{companySize}</option>
          ) : null}
          {COMPANY_SIZES.map((size) => (
            <option key={size}>{size}</option>
          ))}
        </SelectField>
        <SelectField label="Timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} disabled={!admin}>
          {TIMEZONES.map((zone) => (
            <option key={zone}>{zone}</option>
          ))}
        </SelectField>
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        <ErrorText>{error}</ErrorText>
        {admin ? (
          <Button type="submit" data-testid="settings-save" disabled={pending}>
            {pending ? 'Saving…' : 'Update'}
          </Button>
        ) : (
          <p className="text-sm text-muted">Only admins can change workspace settings.</p>
        )}
      </form>
      {membership.isOwner ? (
        <section className="mt-10 rounded-xl border border-red-200 p-4">
          <h3 className="font-semibold text-red-700">Delete workspace</h3>
          <p className="mt-1 text-sm text-muted">Type the workspace URL to confirm. This cannot be undone.</p>
          <div className="mt-3 flex gap-2">
            <input
              data-testid="delete-slug"
              value={confirmSlug}
              onChange={(event) => setConfirmSlug(event.target.value)}
              placeholder={workspace.slug}
              className="h-9 flex-1 rounded-md border border-line px-3 text-sm"
            />
            <Button type="button" variant="danger" onClick={remove}>
              Delete
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
