'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'
import { PRIORITIES } from '@ordr/shared'
import { ApiError, api } from '@/lib/api'
import { PRIORITY_LABEL, ProjectDetail, WorkItem } from '@/lib/work'
import { Button, ErrorText, Spinner, TextField } from '@/components/ui'
import { CommentPanel } from '@/components/collab/comments'

type Relation = {
  id: string
  type: string
  key: string
  title: string
  incoming?: boolean
}

type Detail = WorkItem & {
  description: string
  links: Array<{ id: string; url: string; title: string }>
  attachments: Array<{ id: string; filename: string; size: number; mimeType: string }>
  children: WorkItem[]
  relations: Relation[]
  activity: Array<{
    id: string
    action: string
    field: string | null
    oldValue: string | null
    newValue: string | null
    createdAt: string
    actor: { displayName: string } | null
  }>
  votes: { up: number; down: number; mine: number }
  subscribed: boolean
}

const RELATION_LABEL: Record<string, string> = {
  RELATES_TO: 'Relates to',
  BLOCKS: 'Blocking',
  BLOCKED_BY: 'Blocked by',
  DUPLICATE_OF: 'Duplicate of',
}

function relationLabel(type: string, incoming?: boolean) {
  const label = RELATION_LABEL[type] || type
  return incoming ? `Incoming ${label.toLowerCase()}` : label
}

export default function BrowsePage() {
  const params = useParams<{ workspaceSlug: string; key: string }>()
  const [issue, setIssue] = useState<Detail | null>(null)
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'activity' | 'comments'>('activity')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [childTitle, setChildTitle] = useState('')
  const [relationType, setRelationType] = useState('BLOCKS')
  const [relationKey, setRelationKey] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [linkUrl, setLinkUrl] = useState('')

  async function load() {
    const body = await api<{ issue: Detail }>(`/api/v1/workspaces/${params.workspaceSlug}/browse/${params.key}`)
    setIssue(body.issue)
    setTitle(body.issue.title)
    setDescription(body.issue.description || '')
    if (body.issue.projectId) {
      const projectBody = await api<{ project: ProjectDetail }>(
        `/api/v1/workspaces/${params.workspaceSlug}/projects/${body.issue.projectId}`,
      )
      setProject(projectBody.project)
    }
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Work item not found'))
  }, [params.key, params.workspaceSlug])

  async function patch(body: Record<string, unknown>) {
    if (!issue || !project) return
    const updated = await api<{ issue: WorkItem }>(
      `/api/v1/workspaces/${params.workspaceSlug}/projects/${project.id}/issues/${issue.id}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    )
    setIssue((current) => (current ? { ...current, ...updated.issue } : current))
  }

  async function addChild(event: FormEvent) {
    event.preventDefault()
    if (!issue || !project) return
    await api(`/api/v1/workspaces/${params.workspaceSlug}/projects/${project.id}/issues`, {
      method: 'POST',
      body: JSON.stringify({ title: childTitle, parentId: issue.id }),
    })
    setChildTitle('')
    await load()
  }

  async function addRelation(event: FormEvent) {
    event.preventDefault()
    if (!issue || !project) return
    await api(`/api/v1/workspaces/${params.workspaceSlug}/projects/${project.id}/issues/${issue.id}/relations`, {
      method: 'POST',
      body: JSON.stringify({ type: relationType, relatedKey: relationKey.toUpperCase() }),
    })
    setRelationKey('')
    await load()
  }

  async function addLink(event: FormEvent) {
    event.preventDefault()
    if (!issue || !project) return
    await api(`/api/v1/workspaces/${params.workspaceSlug}/projects/${project.id}/issues/${issue.id}/links`, {
      method: 'POST',
      body: JSON.stringify({ title: linkTitle, url: linkUrl }),
    })
    setLinkTitle('')
    setLinkUrl('')
    await load()
  }

  async function onFile(file: File) {
    if (!issue || !project) return
    const dataBase64 = await file.arrayBuffer().then((buffer) => {
      let binary = ''
      const bytes = new Uint8Array(buffer)
      bytes.forEach((byte) => {
        binary += String.fromCharCode(byte)
      })
      return btoa(binary)
    })
    await api(`/api/v1/workspaces/${params.workspaceSlug}/projects/${project.id}/issues/${issue.id}/attachments`, {
      method: 'POST',
      body: JSON.stringify({ filename: file.name, mimeType: file.type || 'application/octet-stream', dataBase64 }),
    })
    await load()
  }

  if (error && !issue) return <p className="p-8 text-sm text-red-600">{error}</p>
  if (!issue) return <Spinner />

  const projectId = project?.id
  return (
    <div className="grid min-h-full lg:grid-cols-[1fr_300px]">
      <div className="px-8 py-6">
        <p className="text-xs text-muted">
          <Link href={projectId ? `/${params.workspaceSlug}/projects/${projectId}/issues` : `/${params.workspaceSlug}/projects`}>
            Work items
          </Link>{' '}
          / {issue.key}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            data-testid="vote-up"
            onClick={() =>
              api(`/api/v1/workspaces/${params.workspaceSlug}/projects/${projectId}/issues/${issue.id}/vote`, {
                method: 'POST',
                body: JSON.stringify({ value: 1 }),
              }).then(load)
            }
          >
            Up {issue.votes.up}
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              api(`/api/v1/workspaces/${params.workspaceSlug}/projects/${projectId}/issues/${issue.id}/vote`, {
                method: 'POST',
                body: JSON.stringify({ value: -1 }),
              }).then(load)
            }
          >
            Down {issue.votes.down}
          </Button>
          <Button
            variant="secondary"
            data-testid="subscribe"
            onClick={() =>
              api(`/api/v1/workspaces/${params.workspaceSlug}/projects/${projectId}/issues/${issue.id}/subscription`, {
                method: 'POST',
                body: JSON.stringify({ subscribed: !issue.subscribed }),
              }).then(load)
            }
          >
            {issue.subscribed ? 'Unsubscribe' : 'Subscribe'}
          </Button>
        </div>
        <input
          data-testid="detail-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => {
            if (title.trim() && title !== issue.title) patch({ title: title.trim() })
          }}
          className="mt-4 w-full border-0 text-2xl font-semibold outline-none"
        />
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <select
            data-testid="detail-state"
            className="h-8 rounded-md border border-line px-2"
            value={issue.state.id}
            onChange={(event) => patch({ stateId: event.target.value })}
          >
            {project?.states.map((state) => (
              <option key={state.id} value={state.id}>
                {state.name}
              </option>
            ))}
          </select>
          <select
            data-testid="detail-priority"
            className="h-8 rounded-md border border-line px-2"
            value={issue.priority}
            onChange={(event) => patch({ priority: event.target.value })}
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABEL[priority]}
              </option>
            ))}
          </select>
          <select
            className="h-8 rounded-md border border-line px-2"
            value={issue.assignees[0]?.id || ''}
            onChange={(event) =>
              api(`/api/v1/workspaces/${params.workspaceSlug}/projects/${projectId}/issues/${issue.id}/assignees`, {
                method: 'PUT',
                body: JSON.stringify({ assigneeIds: event.target.value ? [event.target.value] : [] }),
              }).then(load)
            }
          >
            <option value="">Unassigned</option>
            {project?.members.map((member) => (
              <option key={member.user.id} value={member.user.id}>
                {member.user.displayName}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="h-8 rounded-md border border-line px-2"
            value={issue.startDate ? issue.startDate.slice(0, 10) : ''}
            onChange={(event) => patch({ startDate: event.target.value || null })}
          />
          <input
            type="date"
            className="h-8 rounded-md border border-line px-2"
            value={issue.dueDate ? issue.dueDate.slice(0, 10) : ''}
            onChange={(event) => patch({ dueDate: event.target.value || null })}
          />
        </div>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          onBlur={() => {
            if (description !== (issue.description || '')) patch({ description })
          }}
          placeholder="Add a description"
          className="mt-4 min-h-28 w-full rounded-md border border-line p-3 text-sm outline-none"
        />

        <section className="mt-6">
          <h2 className="text-sm font-semibold">
            Sub-work items {issue.children.length ? `${issue.children.filter((child) => child.state.group === 'COMPLETED').length}/${issue.children.length}` : ''}
          </h2>
          <ul className="mt-2 space-y-1">
            {issue.children.map((child) => (
              <li key={child.id}>
                <Link data-testid="sub-issue" href={`/${params.workspaceSlug}/browse/${child.key}`} className="text-sm hover:underline">
                  <span className="mr-2 text-xs text-muted">{child.key}</span>
                  {child.title}
                  <span className="ml-2 text-xs text-muted">{child.state.name}</span>
                </Link>
              </li>
            ))}
          </ul>
          <form className="mt-2 flex gap-2" onSubmit={addChild}>
            <TextField data-testid="sub-issue-title" value={childTitle} onChange={(event) => setChildTitle(event.target.value)} placeholder="Add sub-work item" required />
            <Button type="submit" data-testid="sub-issue-submit">
              Add
            </Button>
          </form>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-semibold">Relations</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {issue.relations.map((relation) => (
              <li key={relation.id} data-testid="relation-row">
                {relationLabel(relation.type, relation.incoming)} · {relation.key} {relation.title}
              </li>
            ))}
          </ul>
          <form className="mt-2 flex flex-wrap gap-2" onSubmit={addRelation}>
            <select className="h-9 rounded-md border border-line px-2 text-sm" value={relationType} onChange={(event) => setRelationType(event.target.value)}>
              <option value="RELATES_TO">Relates to</option>
              <option value="BLOCKS">Blocking</option>
              <option value="BLOCKED_BY">Blocked by</option>
              <option value="DUPLICATE_OF">Duplicate of</option>
            </select>
            <input
              data-testid="relation-key"
              value={relationKey}
              onChange={(event) => setRelationKey(event.target.value)}
              placeholder="CLONE-2"
              className="h-9 rounded-md border border-line px-2 text-sm"
              required
            />
            <Button type="submit" data-testid="relation-submit">
              Add relation
            </Button>
          </form>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-semibold">Links</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {issue.links.map((link) => (
              <li key={link.id}>
                <a href={link.url} className="underline" target="_blank" rel="noreferrer">
                  {link.title}
                </a>
              </li>
            ))}
          </ul>
          <form className="mt-2 flex flex-wrap gap-2" onSubmit={addLink}>
            <input value={linkTitle} onChange={(event) => setLinkTitle(event.target.value)} placeholder="Title" className="h-9 rounded-md border border-line px-2 text-sm" required />
            <input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://" className="h-9 rounded-md border border-line px-2 text-sm" required />
            <Button type="submit">Add link</Button>
          </form>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-semibold">Attachments</h2>
          <ul className="mt-2 text-sm">
            {issue.attachments.map((file) => (
              <li key={file.id}>
                <a href={`/api/v1/workspaces/${params.workspaceSlug}/attachments/${file.id}`}>{file.filename}</a>
                <span className="ml-2 text-xs text-muted">{file.size} bytes</span>
              </li>
            ))}
          </ul>
          <input
            type="file"
            className="mt-2 text-sm"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onFile(file).catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Upload failed'))
            }}
          />
        </section>

        <div className="mt-8 flex gap-2 border-b border-line text-sm">
          <button type="button" className={`border-b-2 px-3 py-2 ${tab === 'activity' ? 'border-ink' : 'border-transparent text-muted'}`} onClick={() => setTab('activity')}>
            Activity
          </button>
          <button type="button" className={`border-b-2 px-3 py-2 ${tab === 'comments' ? 'border-ink' : 'border-transparent text-muted'}`} onClick={() => setTab('comments')}>
            Comments
          </button>
        </div>
        {tab === 'activity' ? (
          <ul className="mt-3 space-y-2 text-sm" data-testid="activity">
            {issue.activity.map((row) => (
              <li key={row.id}>
                <span className="font-medium">{row.actor?.displayName || 'Someone'}</span> {row.action}
                {row.field ? ` ${row.field}` : ''}
                {row.newValue ? `: ${row.newValue}` : ''}
              </li>
            ))}
          </ul>
        ) : projectId ? (
          <CommentPanel slug={params.workspaceSlug} projectId={projectId} issueId={issue.id} />
        ) : null}
        <ErrorText>{error}</ErrorText>
      </div>
      <aside className="border-l border-line bg-side p-4 text-sm">
        <p className="text-xs font-semibold text-muted">PROPERTIES</p>
        <p className="mt-3">Parent {issue.parent ? issue.parent.key : 'None'}</p>
        <label className="mt-3 block">
          Labels
          <select
            className="mt-1 h-8 w-full rounded-md border border-line bg-white px-2"
            value={issue.labels[0]?.id || ''}
            onChange={(event) =>
              api(`/api/v1/workspaces/${params.workspaceSlug}/projects/${projectId}/issues/${issue.id}/labels`, {
                method: 'PUT',
                body: JSON.stringify({ labelIds: event.target.value ? [event.target.value] : [] }),
              }).then(load)
            }
          >
            <option value="">None</option>
            {project?.labels.map((label) => (
              <option key={label.id} value={label.id}>
                {label.name}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-4 text-xs font-semibold text-muted">PROJECT</p>
        <p className="mt-2">Cycle {issue.cycle?.name || 'None'}</p>
        <p className="mt-2">Modules {issue.modules?.length ? issue.modules.map((module) => module.name).join(', ') : 'None'}</p>
        <p className="mt-2">{project?.name}</p>
        <p className="mt-4 text-xs text-muted">Created by {issue.createdBy.displayName}</p>
      </aside>
    </div>
  )
}
