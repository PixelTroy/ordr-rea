'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'
import { STATE_GROUPS } from '@ordr/shared'
import { ApiError, api } from '@/lib/api'
import { ProjectDetail, WorkState } from '@/lib/work'
import { Button, ErrorText, Spinner, TextArea, TextField } from '@/components/ui'

const SECTIONS = [
  ['', 'General'],
  ['members', 'Members'],
  ['states', 'States'],
  ['labels', 'Labels'],
  ['estimates', 'Estimates'],
] as const

export default function ProjectSettingsPage() {
  const params = useParams<{ workspaceSlug: string; projectId: string; section?: string[] }>()
  const section = params.section?.[0] || ''
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [error, setError] = useState('')
  const slug = params.workspaceSlug
  const base = `/${slug}/settings/projects/${params.projectId}`

  function load() {
    api<{ project: ProjectDetail }>(`/api/v1/workspaces/${slug}/projects/${params.projectId}`)
      .then((body) => setProject(body.project))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Project not found'))
  }

  useEffect(() => {
    load()
  }, [params.projectId, slug])

  if (!project) return error ? <p className="p-8 text-sm text-red-600">{error}</p> : <Spinner />

  return (
    <div className="flex min-h-full">
      <aside className="w-56 shrink-0 border-r border-line bg-side p-4">
        <p className="px-2 text-xs text-muted">{project.identifier}</p>
        <h1 className="px-2 text-lg font-semibold">{project.name}</h1>
        <nav className="mt-4 space-y-1">
          {SECTIONS.map(([key, label]) => {
            const href = key ? `${base}/${key}` : base
            const active = section === key
            return (
              <Link key={label} href={href} className={`block rounded-md px-2 py-1.5 text-sm ${active ? 'bg-white font-medium' : 'hover:bg-white'}`}>
                {label}
              </Link>
            )
          })}
        </nav>
        <Link href={`/${slug}/projects/${project.id}/issues`} className="mt-6 block px-2 text-xs text-muted underline">
          Back to project
        </Link>
      </aside>
      <div className="min-w-0 flex-1 px-8 py-8">
        {section === '' ? <General project={project} slug={slug} onSaved={load} /> : null}
        {section === 'members' ? <Members project={project} slug={slug} onSaved={load} /> : null}
        {section === 'states' ? <States project={project} slug={slug} onSaved={load} /> : null}
        {section === 'labels' ? <Labels project={project} slug={slug} onSaved={load} /> : null}
        {section === 'estimates' ? <Estimates project={project} slug={slug} onSaved={load} /> : null}
        <ErrorText>{error}</ErrorText>
      </div>
    </div>
  )
}

function General({ project, slug, onSaved }: { project: ProjectDetail; slug: string; onSaved: () => void }) {
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description)
  const [network, setNetwork] = useState(project.network)
  const [timezone, setTimezone] = useState(project.timezone)
  const [message, setMessage] = useState('')

  async function save(event: FormEvent) {
    event.preventDefault()
    await api(`/api/v1/workspaces/${slug}/projects/${project.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name, description, network, timezone }),
    })
    setMessage('Saved')
    onSaved()
  }

  return (
    <form className="max-w-xl space-y-3" onSubmit={save}>
      <h2 className="text-xl font-semibold">General</h2>
      <TextField label="Name" value={name} onChange={(event) => setName(event.target.value)} required />
      <TextArea label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
      <p className="text-sm">Project ID {project.identifier}</p>
      <label className="block text-sm">
        Network
        <select className="mt-1 h-9 w-full rounded-md border border-line px-2" value={network} onChange={(event) => setNetwork(event.target.value as 'PUBLIC' | 'PRIVATE')}>
          <option value="PUBLIC">Public</option>
          <option value="PRIVATE">Private</option>
        </select>
      </label>
      <TextField label="Timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} />
      <div className="flex gap-2">
        <Button type="submit">Update</Button>
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            await api(`/api/v1/workspaces/${slug}/projects/${project.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ archived: !project.archivedAt }),
            })
            onSaved()
          }}
        >
          {project.archivedAt ? 'Unarchive' : 'Archive'}
        </Button>
      </div>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </form>
  )
}

function Members({ project, slug, onSaved }: { project: ProjectDetail; slug: string; onSaved: () => void }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('MEMBER')
  const [error, setError] = useState('')
  const [people, setPeople] = useState<Array<{ user: { id: string; email: string; displayName: string } }>>([])

  useEffect(() => {
    api<{ members: Array<{ user: { id: string; email: string; displayName: string } }> }>(`/api/v1/workspaces/${slug}/members`).then((body) =>
      setPeople(body.members),
    )
  }, [slug])

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold">Members</h2>
      <p className="mt-1 text-sm text-muted">Lead {project.lead?.displayName || 'No lead'}</p>
      <ul className="mt-4 divide-y divide-line border-y border-line text-sm">
        {project.members.map((member) => (
          <li key={member.id} className="flex items-center justify-between py-2">
            <span>
              {member.user.displayName} <span className="text-muted">{member.user.email}</span>
            </span>
            <span className="text-xs">{member.role}</span>
          </li>
        ))}
      </ul>
      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={async (event) => {
          event.preventDefault()
          setError('')
          const person = people.find((member) => member.user.email === email)
          if (!person) {
            setError('That email is not a workspace member')
            return
          }
          await api(`/api/v1/workspaces/${slug}/projects/${project.id}/members`, {
            method: 'POST',
            body: JSON.stringify({ userId: person.user.id, role }),
          })
          setEmail('')
          onSaved()
        }}
      >
        <TextField label="Workspace member email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <select className="h-9 rounded-md border border-line px-2 text-sm" value={role} onChange={(event) => setRole(event.target.value)}>
          <option value="ADMIN">Admin</option>
          <option value="MEMBER">Member</option>
          <option value="GUEST">Guest</option>
        </select>
        <Button type="submit">Add member</Button>
      </form>
      <ErrorText>{error}</ErrorText>
    </div>
  )
}

function States({ project, slug, onSaved }: { project: ProjectDetail; slug: string; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [group, setGroup] = useState<(typeof STATE_GROUPS)[number]>('UNSTARTED')
  return (
    <div>
      <h2 className="text-xl font-semibold">States</h2>
      {STATE_GROUPS.map((stateGroup) => (
        <section key={stateGroup} className="mt-4">
          <h3 className="text-xs font-semibold text-muted">{stateGroup}</h3>
          <ul className="mt-1 text-sm">
            {project.states
              .filter((state) => state.group === stateGroup)
              .map((state) => (
                <StateRow key={state.id} state={state} slug={slug} projectId={project.id} onSaved={onSaved} />
              ))}
          </ul>
        </section>
      ))}
      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={async (event) => {
          event.preventDefault()
          await api(`/api/v1/workspaces/${slug}/projects/${project.id}/states`, {
            method: 'POST',
            body: JSON.stringify({ name, group, color: '#60646c' }),
          })
          setName('')
          onSaved()
        }}
      >
        <TextField label="New state" value={name} onChange={(event) => setName(event.target.value)} required />
        <select className="h-9 rounded-md border border-line px-2 text-sm" value={group} onChange={(event) => setGroup(event.target.value as (typeof STATE_GROUPS)[number])}>
          {STATE_GROUPS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <Button type="submit">Add state</Button>
      </form>
    </div>
  )
}

function StateRow({ state, slug, projectId, onSaved }: { state: WorkState; slug: string; projectId: string; onSaved: () => void }) {
  return (
    <li className="flex items-center gap-2 py-1">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: state.color }} />
      {state.name}
      {state.isDefault ? <span className="text-xs text-muted">default</span> : null}
      <button
        type="button"
        className="ml-auto text-xs text-muted"
        onClick={async () => {
          await api(`/api/v1/workspaces/${slug}/projects/${projectId}/states/${state.id}`, { method: 'DELETE' })
          onSaved()
        }}
      >
        Delete
      </button>
    </li>
  )
}

function Labels({ project, slug, onSaved }: { project: ProjectDetail; slug: string; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#ef4444')
  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold">Labels</h2>
      <ul className="mt-3 space-y-1 text-sm">
        {project.labels.map((label) => (
          <li key={label.id} className="flex items-center gap-2">
            <span className="rounded px-2 py-0.5 text-white" style={{ background: label.color }}>
              {label.name}
            </span>
            <button
              type="button"
              className="text-xs text-muted"
              onClick={async () => {
                await api(`/api/v1/workspaces/${slug}/projects/${project.id}/labels/${label.id}`, { method: 'DELETE' })
                onSaved()
              }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-4 flex items-end gap-2"
        onSubmit={async (event) => {
          event.preventDefault()
          await api(`/api/v1/workspaces/${slug}/projects/${project.id}/labels`, {
            method: 'POST',
            body: JSON.stringify({ name, color }),
          })
          setName('')
          onSaved()
        }}
      >
        <TextField label="Add label" value={name} onChange={(event) => setName(event.target.value)} required />
        <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-9 w-12" />
        <Button type="submit">Add label</Button>
      </form>
    </div>
  )
}

function Estimates({ project, slug, onSaved }: { project: ProjectDetail; slug: string; onSaved: () => void }) {
  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold">Estimates</h2>
      <p className="mt-2 text-sm text-muted">Current system: {project.estimateType}</p>
      <div className="mt-4 flex gap-2">
        <Button
          variant="secondary"
          onClick={async () => {
            await api(`/api/v1/workspaces/${slug}/projects/${project.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ estimateType: 'POINTS' }),
            })
            onSaved()
          }}
        >
          Points 1, 2, 3, 5, 8
        </Button>
        <Button
          variant="secondary"
          onClick={async () => {
            await api(`/api/v1/workspaces/${slug}/projects/${project.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ estimateType: 'CATEGORIES' }),
            })
            onSaved()
          }}
        >
          T-shirt XS–XL
        </Button>
        <Button
          variant="ghost"
          onClick={async () => {
            await api(`/api/v1/workspaces/${slug}/projects/${project.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ estimateType: 'NONE' }),
            })
            onSaved()
          }}
        >
          None
        </Button>
      </div>
    </div>
  )
}
