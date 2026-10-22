'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ApiError, api } from '@/lib/api'
import { ProjectCard, suggestIdentifier } from '@/lib/work'
import { useWorkspace } from '@/components/shell/workspace-provider'
import { Avatar, Button, EmptyState, ErrorText, Modal, Spinner, TextField } from '@/components/ui'

export default function ProjectsPage() {
  const router = useRouter()
  const { slug } = useWorkspace()
  const [projects, setProjects] = useState<ProjectCard[] | null>(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'created' | 'name'>('created')
  const [network, setNetwork] = useState('')
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [touchedId, setTouchedId] = useState(false)
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function load() {
    api<{ projects: ProjectCard[] }>(`/api/v1/workspaces/${slug}/projects`)
      .then((body) => setProjects(body.projects))
      .catch(() => setProjects([]))
  }

  useEffect(() => {
    load()
  }, [slug])

  const visible = useMemo(() => {
    const list = (projects || []).filter((project) => {
      if (network && project.network !== network) return false
      if (search && !`${project.name} ${project.identifier}`.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    return list.sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : b.createdAt.localeCompare(a.createdAt)))
  }, [projects, search, sort, network])

  async function create(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const created = await api<{ project: ProjectCard }>(`/api/v1/workspaces/${slug}/projects`, {
        method: 'POST',
        body: JSON.stringify({ name, identifier, network: visibility }),
      })
      router.push(`/${slug}/projects/${created.project.id}/issues`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the project')
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-6 py-4">
        <h1 className="mr-auto text-xl font-semibold">Projects</h1>
        <input
          data-testid="project-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search"
          className="h-8 w-44 rounded-md border border-line px-3 text-sm"
        />
        <select className="h-8 rounded-md border border-line px-2 text-sm" value={sort} onChange={(event) => setSort(event.target.value as 'created' | 'name')}>
          <option value="created">Created date</option>
          <option value="name">Name</option>
        </select>
        <select className="h-8 rounded-md border border-line px-2 text-sm" value={network} onChange={(event) => setNetwork(event.target.value)}>
          <option value="">All networks</option>
          <option value="PUBLIC">Public</option>
          <option value="PRIVATE">Private</option>
        </select>
        <Button data-testid="add-project" onClick={() => setOpen(true)}>
          Add project
        </Button>
      </div>
      {projects === null ? <Spinner /> : null}
      {projects && visible.length === 0 ? (
        <EmptyState title="No projects yet" body="Projects group work items, cycles, modules, views, and pages." />
      ) : null}
      <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((project) => (
          <button
            key={project.id}
            type="button"
            data-testid="project-card"
            onClick={() => router.push(`/${slug}/projects/${project.id}/issues`)}
            className="overflow-hidden rounded-xl border border-line text-left hover:border-ink/30"
          >
            <div className="h-16" style={{ background: project.coverColor }} />
            <div className="p-4">
              <p className="text-sm font-semibold">
                {project.emoji} {project.name}
              </p>
              <p className="mt-1 text-xs text-muted">{project.identifier}</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted">
                {project.lead ? <Avatar name={project.lead.displayName} color={project.lead.avatarColor} size={18} /> : <span>No lead</span>}
                {project.joined ? <span className="rounded bg-canvas px-1.5 py-0.5">Joined</span> : null}
              </div>
            </div>
          </button>
        ))}
      </div>
      {open ? (
        <Modal title="Add project" onClose={() => setOpen(false)}>
          <form className="space-y-3" onSubmit={create}>
            <TextField
              label="Project name"
              data-testid="project-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                if (!touchedId) setIdentifier(suggestIdentifier(event.target.value))
              }}
              required
            />
            <TextField
              label="Project ID"
              data-testid="project-identifier"
              value={identifier}
              onChange={(event) => {
                setTouchedId(true)
                setIdentifier(event.target.value.toUpperCase())
              }}
              required
            />
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">Network</span>
              <select className="h-9 w-full rounded-md border border-line px-3" value={visibility} onChange={(event) => setVisibility(event.target.value as 'PUBLIC' | 'PRIVATE')}>
                <option value="PUBLIC">Public</option>
                <option value="PRIVATE">Private</option>
              </select>
            </label>
            <ErrorText>{error}</ErrorText>
            <div className="flex justify-end">
              <Button type="submit" data-testid="project-submit" disabled={busy}>
                Create project
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  )
}
