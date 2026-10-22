'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { COMPANY_SIZES, TIMEZONES, slugify } from '@ordr/shared'
import { AuthFrame } from '@/components/auth-frame'
import { Button, ErrorText, SelectField, TextField } from '@/components/ui'
import { api, ApiError } from '@/lib/api'

export default function CreateWorkspacePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [touched, setTouched] = useState(false)
  const [companySize, setCompanySize] = useState('1-10')
  const [timezone, setTimezone] = useState('UTC')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      const data = await api<{ workspace: { slug: string } }>('/api/v1/workspaces', {
        method: 'POST',
        body: JSON.stringify({ name, slug, companySize, timezone }),
      })
      router.replace(`/${data.workspace.slug}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the workspace')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthFrame title="Create a workspace" subtitle="This is the home for your projects and members.">
      <form onSubmit={submit} className="space-y-3">
        <TextField
          label="Workspace name"
          data-testid="workspace-name"
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
          data-testid="workspace-slug"
          value={slug}
          onChange={(event) => {
            setTouched(true)
            setSlug(slugify(event.target.value))
          }}
          required
        />
        <SelectField label="Company size" value={companySize} onChange={(event) => setCompanySize(event.target.value)}>
          {COMPANY_SIZES.map((size) => (
            <option key={size}>{size}</option>
          ))}
        </SelectField>
        <SelectField label="Timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
          {TIMEZONES.map((zone) => (
            <option key={zone}>{zone}</option>
          ))}
        </SelectField>
        <ErrorText>{error}</ErrorText>
        <Button className="w-full" type="submit" data-testid="workspace-submit" disabled={pending || slug.length < 3}>
          {pending ? 'Creating…' : 'Create workspace'}
        </Button>
      </form>
    </AuthFrame>
  )
}
