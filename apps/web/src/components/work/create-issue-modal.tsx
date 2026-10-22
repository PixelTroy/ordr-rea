'use client'

import { FormEvent, useEffect, useState } from 'react'
import { PRIORITIES } from '@ordr/shared'
import { ApiError, api } from '@/lib/api'
import { PRIORITY_LABEL, ProjectDetail, WorkItem } from '@/lib/work'
import { Button, ErrorText, Modal, TextArea, TextField } from '@/components/ui'

export type CreateIssueSeed = {
  projectId?: string
  stateId?: string
  parentId?: string
}

export function CreateIssueModal({
  slug,
  seed,
  onClose,
  onCreated,
}: {
  slug: string
  seed: CreateIssueSeed
  onClose: () => void
  onCreated: (issue: WorkItem) => void
}) {
  const [projects, setProjects] = useState<Array<{ id: string; name: string; identifier: string }>>([])
  const [projectId, setProjectId] = useState(seed.projectId || '')
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [stateId, setStateId] = useState(seed.stateId || '')
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>('NONE')
  const [assigneeId, setAssigneeId] = useState('')
  const [labelId, setLabelId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [parentKey, setParentKey] = useState('')
  const [createMore, setCreateMore] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (seed.projectId) return
    api<{ projects: Array<{ id: string; name: string; identifier: string }> }>(`/api/v1/workspaces/${slug}/projects`)
      .then((body) => {
        setProjects(body.projects)
        setProjectId((current) => current || body.projects[0]?.id || '')
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load projects'))
  }, [seed.projectId, slug])

  useEffect(() => {
    if (!projectId) return
    api<{ project: ProjectDetail }>(`/api/v1/workspaces/${slug}/projects/${projectId}`)
      .then((body) => {
        setProject(body.project)
        setStateId((current) => current || body.project.states.find((state) => state.isDefault)?.id || body.project.states[0]?.id || '')
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load project'))
  }, [projectId, slug])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!project) return
    setBusy(true)
    setError('')
    try {
      let parentId = seed.parentId
      if (!parentId && parentKey.trim()) {
        const browsed = await api<{ issue: WorkItem }>(
          `/api/v1/workspaces/${slug}/browse/${encodeURIComponent(parentKey.trim().toUpperCase())}`,
        )
        parentId = browsed.issue.id
      }
      const created = await api<{ issue: WorkItem }>(`/api/v1/workspaces/${slug}/projects/${project.id}/issues`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          stateId,
          priority,
          assigneeIds: assigneeId ? [assigneeId] : [],
          labelIds: labelId ? [labelId] : [],
          startDate: startDate || null,
          dueDate: dueDate || null,
          parentId: parentId || null,
        }),
      })
      onCreated(created.issue)
      if (createMore) {
        setTitle('')
        setDescription('')
      } else {
        onClose()
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the work item')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Create work item" onClose={onClose} wide>
      <form className="space-y-3" onSubmit={submit}>
        {!seed.projectId ? (
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Project</span>
            <select
              data-testid="issue-project"
              className="h-9 w-full rounded-md border border-line px-3"
              value={projectId}
              onChange={(event) => {
                setProjectId(event.target.value)
                setStateId('')
              }}
            >
              {projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.identifier} · {item.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-xs text-muted">
            {project ? `${project.identifier} · ${project.name}` : 'Loading project'}
          </p>
        )}
        <TextField label="Title" data-testid="issue-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
        <TextArea label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">State</span>
            <select className="h-9 w-full rounded-md border border-line px-3" value={stateId} onChange={(event) => setStateId(event.target.value)}>
              {project?.states.map((state) => (
                <option key={state.id} value={state.id}>
                  {state.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Priority</span>
            <select
              className="h-9 w-full rounded-md border border-line px-3"
              value={priority}
              onChange={(event) => setPriority(event.target.value as (typeof PRIORITIES)[number])}
            >
              {PRIORITIES.map((item) => (
                <option key={item} value={item}>
                  {PRIORITY_LABEL[item]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Assignee</span>
            <select className="h-9 w-full rounded-md border border-line px-3" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
              <option value="">Unassigned</option>
              {project?.members.map((member) => (
                <option key={member.user.id} value={member.user.id}>
                  {member.user.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Label</span>
            <select className="h-9 w-full rounded-md border border-line px-3" value={labelId} onChange={(event) => setLabelId(event.target.value)}>
              <option value="">None</option>
              {project?.labels.map((label) => (
                <option key={label.id} value={label.id}>
                  {label.name}
                </option>
              ))}
            </select>
          </label>
          <TextField label="Start date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <TextField label="Due date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </div>
        {seed.parentId ? (
          <p className="text-xs text-muted">This will be created as a sub-work item.</p>
        ) : (
          <TextField
            label="Parent"
            placeholder="CLONE-1"
            value={parentKey}
            onChange={(event) => setParentKey(event.target.value)}
          />
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={createMore} onChange={(event) => setCreateMore(event.target.checked)} />
          Create more
        </label>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Discard
          </Button>
          <Button type="submit" data-testid="issue-submit" disabled={busy || !title.trim()}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  )
}
