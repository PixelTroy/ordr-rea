'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  CalendarRange,
  Columns3,
  Filter,
  GanttChart,
  LayoutList,
  Plus,
  SlidersHorizontal,
  Table2,
} from 'lucide-react'
import { ApiError, api } from '@/lib/api'
import { PRIORITY_COLOR, PRIORITY_LABEL, ProjectDetail, WorkItem, dayKey, formatDay } from '@/lib/work'
import { Avatar, Button, EmptyState, ErrorText, Spinner } from '@/components/ui'
import { CreateIssueModal, CreateIssueSeed } from '@/components/work/create-issue-modal'

const LAYOUTS = [
  { id: 'list', label: 'List', icon: LayoutList },
  { id: 'kanban', label: 'Kanban', icon: Columns3 },
  { id: 'calendar', label: 'Calendar', icon: CalendarRange },
  { id: 'spreadsheet', label: 'Spreadsheet', icon: Table2 },
  { id: 'gantt', label: 'Gantt', icon: GanttChart },
] as const

type LayoutId = (typeof LAYOUTS)[number]['id']

export type BoardFilters = {
  search: string
  stateId: string
  priority: string
  assigneeId: string
  labelId: string
}

const EMPTY_FILTERS: BoardFilters = { search: '', stateId: '', priority: '', assigneeId: '', labelId: '' }

type DisplayPrefs = {
  layout: LayoutId
  groupBy: 'state' | 'priority' | 'none'
  orderBy: 'created' | 'updated' | 'priority'
  showEmpty: boolean
  showSubIssues: boolean
  properties: Record<string, boolean>
  weekends: boolean
  ganttScale: 'week' | 'month' | 'quarter'
}

const DEFAULT_PREFS: DisplayPrefs = {
  layout: 'list',
  groupBy: 'state',
  orderBy: 'created',
  showEmpty: true,
  showSubIssues: true,
  weekends: false,
  ganttScale: 'month',
  properties: {
    id: true,
    assignee: true,
    start: true,
    due: true,
    labels: true,
    priority: true,
    state: true,
    sub: true,
    attachment: true,
    link: true,
  },
}

const PRIORITY_RANK: Record<WorkItem['priority'], number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  NONE: 4,
}

function loadPrefs(projectId: string): DisplayPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS
  try {
    const raw = localStorage.getItem(`ordr:display:${projectId}`)
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw), properties: { ...DEFAULT_PREFS.properties, ...JSON.parse(raw).properties } } : DEFAULT_PREFS
  } catch {
    return DEFAULT_PREFS
  }
}

export function WorkItemsBoard({
  slug,
  projectId,
  view,
}: {
  slug: string
  projectId: string
  view?: {
    id: string
    layout?: string
    filters?: Partial<BoardFilters>
    onFiltersChange?: (filters: BoardFilters) => void
    onLayoutChange?: (layout: LayoutId) => void
  }
}) {
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [issues, setIssues] = useState<WorkItem[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [prefs, setPrefs] = useState<DisplayPrefs>(DEFAULT_PREFS)
  const [menu, setMenu] = useState<'display' | 'filter' | null>(null)
  const [filters, setFilters] = useState<BoardFilters>(EMPTY_FILTERS)
  const [seed, setSeed] = useState<CreateIssueSeed | null>(null)
  const [month, setMonth] = useState(() => new Date())

  function reload() {
    return Promise.all([
      api<{ project: ProjectDetail }>(`/api/v1/workspaces/${slug}/projects/${projectId}`),
      api<{ issues: WorkItem[] }>(`/api/v1/workspaces/${slug}/projects/${projectId}/issues`),
    ])
      .then(([projectBody, issueBody]) => {
        setProject(projectBody.project)
        setIssues(issueBody.issues)
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load work items'))
  }

  useEffect(() => {
    const loaded = loadPrefs(projectId)
    if (view?.layout) {
      const mapped = view.layout.toLowerCase() as LayoutId
      if (LAYOUTS.some((item) => item.id === mapped)) loaded.layout = mapped
    }
    setPrefs(loaded)
    if (view) setFilters({ ...EMPTY_FILTERS, ...view.filters })
    setLoading(true)
    reload().finally(() => setLoading(false))
  }, [projectId, slug, view?.id])

  function updatePrefs(next: Partial<DisplayPrefs>) {
    setPrefs((current) => {
      const merged = { ...current, ...next }
      if (!view) localStorage.setItem(`ordr:display:${projectId}`, JSON.stringify(merged))
      return merged
    })
    if (next.layout) view?.onLayoutChange?.(next.layout)
  }

  function changeFilters(next: BoardFilters) {
    setFilters(next)
    view?.onFiltersChange?.(next)
  }

  const visible = useMemo(() => {
    const filtered = issues.filter((issue) => {
      if (!prefs.showSubIssues && issue.parent) return false
      if (filters.search && !`${issue.key} ${issue.title}`.toLowerCase().includes(filters.search.toLowerCase())) return false
      if (filters.stateId && issue.state.id !== filters.stateId) return false
      if (filters.priority && issue.priority !== filters.priority) return false
      if (filters.assigneeId && !issue.assignees.some((user) => user.id === filters.assigneeId)) return false
      if (filters.labelId && !issue.labels.some((label) => label.id === filters.labelId)) return false
      return true
    })
    const rank = (issue: WorkItem) => {
      if (prefs.orderBy === 'priority') return PRIORITY_RANK[issue.priority]
      if (prefs.orderBy === 'updated') return -new Date(issue.updatedAt).getTime()
      return new Date(issue.createdAt).getTime()
    }
    return filtered.sort((a, b) => rank(a) - rank(b))
  }, [issues, filters, prefs])

  const groups = useMemo(() => {
    if (!project) return []
    if (prefs.groupBy === 'none') return [{ id: 'all', name: 'All work items', color: '#6b7280', items: visible }]
    if (prefs.groupBy === 'priority') {
      return (['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE'] as const).map((priority) => ({
        id: priority,
        name: PRIORITY_LABEL[priority],
        color: PRIORITY_COLOR[priority],
        items: visible.filter((issue) => issue.priority === priority),
      }))
    }
    return project.states.map((state) => ({
      id: state.id,
      name: state.name,
      color: state.color,
      items: visible.filter((issue) => issue.state.id === state.id),
    }))
  }, [project, prefs.groupBy, visible])

  const shownGroups = prefs.showEmpty ? groups : groups.filter((group) => group.items.length > 0)
  const activeFilters = [filters.stateId, filters.priority, filters.assigneeId, filters.labelId, filters.search].filter(Boolean).length

  async function moveIssue(issueId: string, stateId: string) {
    const issue = issues.find((item) => item.id === issueId)
    const state = project?.states.find((item) => item.id === stateId)
    if (!issue || !state || issue.state.id === stateId) return
    setIssues((current) => current.map((item) => (item.id === issueId ? { ...item, state } : item)))
    try {
      await api(`/api/v1/workspaces/${slug}/projects/${projectId}/issues/${issueId}`, {
        method: 'PATCH',
        body: JSON.stringify({ stateId }),
      })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not move the work item')
      reload()
    }
  }

  if (loading) return <Spinner />
  if (!project) return <ErrorText>{error || 'Project not found'}</ErrorText>

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
        <span className="rounded-md bg-canvas px-2 py-1 text-xs font-medium text-muted" data-testid="issue-count">
          {visible.length}
        </span>
        <div className="flex overflow-hidden rounded-md border border-line">
          {LAYOUTS.map((layout) => {
            const Icon = layout.icon
            const active = prefs.layout === layout.id
            return (
              <button
                key={layout.id}
                type="button"
                aria-label={layout.label}
                data-testid={`layout-${layout.id}`}
                title={layout.label}
                className={`grid h-8 w-8 place-items-center ${active ? 'bg-canvas text-ink' : 'text-muted hover:bg-canvas'}`}
                onClick={() => updatePrefs({ layout: layout.id })}
              >
                <Icon size={15} />
              </button>
            )
          })}
        </div>
        <div className="relative">
          <Button variant="ghost" data-testid="filter-button" onClick={() => setMenu(menu === 'filter' ? null : 'filter')}>
            <Filter size={14} /> Filters{activeFilters ? ` · ${activeFilters}` : ''}
          </Button>
          {menu === 'filter' ? (
            <div className="absolute left-0 top-10 z-20 w-72 rounded-xl border border-line bg-white p-3 shadow-pop">
              <input
                data-testid="filter-search"
                value={filters.search}
                onChange={(event) => changeFilters({ ...filters, search: event.target.value })}
                placeholder="Search title"
                className="mb-2 h-8 w-full rounded-md border border-line px-2 text-sm"
              />
              <FilterSelect
                label="State"
                value={filters.stateId}
                onChange={(stateId) => changeFilters({ ...filters, stateId })}
                options={project.states.map((state) => ({ value: state.id, label: state.name }))}
              />
              <FilterSelect
                label="Priority"
                value={filters.priority}
                onChange={(priority) => changeFilters({ ...filters, priority })}
                options={Object.entries(PRIORITY_LABEL).map(([value, label]) => ({ value, label }))}
              />
              <FilterSelect
                label="Assignee"
                value={filters.assigneeId}
                onChange={(assigneeId) => changeFilters({ ...filters, assigneeId })}
                options={project.members.map((member) => ({ value: member.user.id, label: member.user.displayName }))}
              />
              <FilterSelect
                label="Label"
                value={filters.labelId}
                onChange={(labelId) => changeFilters({ ...filters, labelId })}
                options={project.labels.map((label) => ({ value: label.id, label: label.name }))}
              />
              <button
                type="button"
                className="mt-2 text-xs text-muted underline"
                onClick={() => changeFilters(EMPTY_FILTERS)}
              >
                Clear all
              </button>
            </div>
          ) : null}
        </div>
        <div className="relative">
          <Button variant="ghost" data-testid="display-button" onClick={() => setMenu(menu === 'display' ? null : 'display')}>
            <SlidersHorizontal size={14} /> Display
          </Button>
          {menu === 'display' ? (
            <div className="absolute left-0 top-10 z-20 w-72 rounded-xl border border-line bg-white p-3 shadow-pop">
              <p className="mb-2 text-xs font-semibold text-muted">DISPLAY PROPERTIES</p>
              <div className="grid grid-cols-2 gap-1">
                {Object.keys(prefs.properties).map((key) => (
                  <label key={key} className="flex items-center gap-1.5 text-xs capitalize">
                    <input
                      type="checkbox"
                      checked={prefs.properties[key]}
                      onChange={(event) =>
                        updatePrefs({ properties: { ...prefs.properties, [key]: event.target.checked } })
                      }
                    />
                    {key}
                  </label>
                ))}
              </div>
              <label className="mt-3 block text-xs">
                Group by
                <select
                  className="mt-1 h-8 w-full rounded-md border border-line px-2"
                  value={prefs.groupBy}
                  onChange={(event) => updatePrefs({ groupBy: event.target.value as DisplayPrefs['groupBy'] })}
                >
                  <option value="state">States</option>
                  <option value="priority">Priority</option>
                  <option value="none">None</option>
                </select>
              </label>
              <label className="mt-2 block text-xs">
                Order by
                <select
                  className="mt-1 h-8 w-full rounded-md border border-line px-2"
                  value={prefs.orderBy}
                  onChange={(event) => updatePrefs({ orderBy: event.target.value as DisplayPrefs['orderBy'] })}
                >
                  <option value="created">Created at</option>
                  <option value="updated">Updated at</option>
                  <option value="priority">Priority</option>
                </select>
              </label>
              <label className="mt-2 flex items-center gap-2 text-xs">
                <input type="checkbox" checked={prefs.showSubIssues} onChange={(event) => updatePrefs({ showSubIssues: event.target.checked })} />
                Show sub-work items
              </label>
              <label className="mt-1 flex items-center gap-2 text-xs">
                <input type="checkbox" checked={prefs.showEmpty} onChange={(event) => updatePrefs({ showEmpty: event.target.checked })} />
                Show empty groups
              </label>
            </div>
          ) : null}
        </div>
        <div className="ml-auto">
          {project.canWrite ? (
            <Button data-testid="add-work-item" onClick={() => setSeed({ projectId })}>
              <Plus size={14} /> Add work item
            </Button>
          ) : null}
        </div>
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="min-h-0 flex-1 overflow-auto">
        {visible.length === 0 && prefs.layout !== 'kanban' && prefs.layout !== 'calendar' ? (
          <EmptyState
            title="No work items"
            body="Create the first work item for this project. It starts in Backlog unless you pick another state."
            action={
              project.canWrite ? (
                <Button data-testid="add-work-item-empty" onClick={() => setSeed({ projectId })}>
                  Add work item
                </Button>
              ) : null
            }
          />
        ) : null}
        {prefs.layout === 'list' && visible.length > 0 ? (
          <div>
            {shownGroups.map((group) => (
              <section key={group.id}>
                <header className="sticky top-0 flex items-center gap-2 bg-white px-4 py-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: group.color }} />
                  <span className="font-medium">{group.name}</span>
                  <span className="text-xs text-muted">{group.items.length}</span>
                  {project.canWrite && prefs.groupBy === 'state' ? (
                    <button type="button" className="ml-auto text-muted hover:text-ink" aria-label={`Add to ${group.name}`} onClick={() => setSeed({ projectId, stateId: group.id })}>
                      <Plus size={14} />
                    </button>
                  ) : null}
                </header>
                {group.items.map((issue) => (
                  <IssueRow key={issue.id} slug={slug} issue={issue} prefs={prefs} />
                ))}
              </section>
            ))}
          </div>
        ) : null}
        {prefs.layout === 'kanban' ? (
          <div className="flex h-full gap-3 overflow-auto p-4">
            {shownGroups.map((group) => (
              <div
                key={group.id}
                data-testid={`kanban-${group.name}`}
                className="flex w-72 shrink-0 flex-col rounded-xl bg-canvas"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  const id = event.dataTransfer.getData('text/plain')
                  if (prefs.groupBy === 'state') moveIssue(id, group.id)
                }}
              >
                <header className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: group.color }} />
                  <span className="font-medium">{group.name}</span>
                  <span className="text-xs text-muted">{group.items.length}</span>
                </header>
                <div className="flex flex-col gap-2 px-2 pb-2">
                  {group.items.map((issue) => (
                    <Link
                      key={issue.id}
                      href={`/${slug}/browse/${issue.key}`}
                      draggable
                      data-testid="issue-card"
                      onDragStart={(event) => event.dataTransfer.setData('text/plain', issue.id)}
                      className="rounded-lg border border-line bg-white p-3 text-sm shadow-sm"
                    >
                      {prefs.properties.id ? <p className="text-xs text-muted">{issue.key}</p> : null}
                      <p className="font-medium">{issue.title}</p>
                      <Chips issue={issue} prefs={prefs} />
                    </Link>
                  ))}
                  {project.canWrite && prefs.groupBy === 'state' ? (
                    <button type="button" className="rounded-md px-2 py-1 text-left text-xs text-muted hover:bg-white" onClick={() => setSeed({ projectId, stateId: group.id })}>
                      New work item
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {prefs.layout === 'calendar' ? (
          <CalendarView
            issues={visible}
            slug={slug}
            month={month}
            setMonth={setMonth}
            weekends={prefs.weekends}
            onWeekends={(weekends) => updatePrefs({ weekends })}
          />
        ) : null}
        {prefs.layout === 'spreadsheet' && visible.length > 0 ? <Spreadsheet issues={visible} slug={slug} /> : null}
        {prefs.layout === 'gantt' && visible.length > 0 ? (
          <Gantt issues={visible} slug={slug} scale={prefs.ganttScale} onScale={(ganttScale) => updatePrefs({ ganttScale })} />
        ) : null}
      </div>
      {seed ? (
        <CreateIssueModal
          slug={slug}
          seed={seed}
          onClose={() => setSeed(null)}
          onCreated={() => {
            reload()
          }}
        />
      ) : null}
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="mb-2 block text-xs">
      {label}
      <select className="mt-1 h-8 w-full rounded-md border border-line px-2" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Any</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function Chips({ issue, prefs }: { issue: WorkItem; prefs: DisplayPrefs }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-muted">
      {prefs.properties.state ? <span className="rounded bg-canvas px-1.5 py-0.5">{issue.state.name}</span> : null}
      {prefs.properties.priority && issue.priority !== 'NONE' ? (
        <span className="rounded px-1.5 py-0.5 text-white" style={{ background: PRIORITY_COLOR[issue.priority] }}>
          {PRIORITY_LABEL[issue.priority]}
        </span>
      ) : null}
      {prefs.properties.start && issue.startDate ? <span>{formatDay(issue.startDate)}</span> : null}
      {prefs.properties.due && issue.dueDate ? <span>→ {formatDay(issue.dueDate)}</span> : null}
      {prefs.properties.labels
        ? issue.labels.map((label) => (
            <span key={label.id} className="rounded px-1.5 py-0.5 text-white" style={{ background: label.color }}>
              {label.name}
            </span>
          ))
        : null}
      {issue.cycle ? <span className="rounded bg-canvas px-1.5 py-0.5">{issue.cycle.name}</span> : null}
      {issue.modules?.map((module) => (
        <span key={module.id} className="rounded bg-canvas px-1.5 py-0.5">
          {module.name}
        </span>
      ))}
      {prefs.properties.sub && issue.subIssueCount ? <span>{issue.subIssueDone}/{issue.subIssueCount}</span> : null}
      {prefs.properties.attachment && issue.attachmentCount ? <span>{issue.attachmentCount} files</span> : null}
      {prefs.properties.link && issue.linkCount ? <span>{issue.linkCount} links</span> : null}
      {prefs.properties.assignee
        ? issue.assignees.map((user) => <Avatar key={user.id} name={user.displayName} color={user.avatarColor} size={18} />)
        : null}
    </div>
  )
}

function IssueRow({ slug, issue, prefs }: { slug: string; issue: WorkItem; prefs: DisplayPrefs }) {
  return (
    <Link
      href={`/${slug}/browse/${issue.key}`}
      data-testid="issue-row"
      className="flex items-center gap-3 border-t border-line px-4 py-2 text-sm hover:bg-canvas"
    >
      {prefs.properties.id ? <span className="w-20 shrink-0 text-xs text-muted">{issue.key}</span> : null}
      <span className="min-w-0 flex-1 truncate font-medium">{issue.title}</span>
      <Chips issue={issue} prefs={prefs} />
    </Link>
  )
}

function CalendarView({
  issues,
  slug,
  month,
  setMonth,
  weekends,
  onWeekends,
}: {
  issues: WorkItem[]
  slug: string
  month: Date
  setMonth: (date: Date) => void
  weekends: boolean
  onWeekends: (value: boolean) => void
}) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const first = new Date(year, monthIndex, 1)
  const startPad = (first.getDay() + 6) % 7
  const days = new Date(year, monthIndex + 1, 0).getDate()
  const cells = Array.from({ length: startPad + days }, (_, index) => (index < startPad ? null : index - startPad + 1))
  const names = weekends ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const today = dayKey(new Date().toISOString())
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Button variant="secondary" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}>
          Prev
        </Button>
        <Button variant="secondary" onClick={() => setMonth(new Date())}>
          Today
        </Button>
        <Button variant="secondary" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}>
          Next
        </Button>
        <span className="text-sm font-medium">{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
        <label className="ml-auto flex items-center gap-2 text-xs">
          <input type="checkbox" checked={weekends} onChange={(event) => onWeekends(event.target.checked)} />
          Weekends
        </label>
      </div>
      <div className={`grid gap-px bg-line ${weekends ? 'grid-cols-7' : 'grid-cols-5'}`}>
        {names.map((name) => (
          <div key={name} className="bg-canvas px-2 py-1 text-xs text-muted">
            {name}
          </div>
        ))}
        {cells.map((day, index) => {
          const weekday = index % 7
          if (!weekends && weekday >= 5) return null
          const key = day ? dayKey(new Date(year, monthIndex, day).toISOString()) : ''
          const matched = issues.filter((issue) => dayKey(issue.dueDate) === key || dayKey(issue.startDate) === key)
          return (
            <div key={index} className={`min-h-24 bg-white p-1 ${key === today ? 'ring-1 ring-inset ring-accent' : ''}`}>
              <p className="text-xs text-muted">{day || ''}</p>
              {matched.map((issue) => (
                <Link key={issue.id} href={`/${slug}/browse/${issue.key}`} className="mt-1 block truncate rounded bg-canvas px-1 text-[11px]">
                  {issue.key} {issue.title}
                </Link>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Spreadsheet({ issues, slug }: { issues: WorkItem[]; slug: string }) {
  return (
    <table className="w-full border-collapse text-left text-sm">
      <thead className="sticky top-0 bg-canvas text-xs text-muted">
        <tr>
          {['Work item', 'State', 'Priority', 'Assignees', 'Labels', 'Start date', 'Due date'].map((column) => (
            <th key={column} className="border-b border-line px-3 py-2 font-medium">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {issues.map((issue) => (
          <tr key={issue.id} className="border-b border-line" data-testid="issue-row">
            <td className="px-3 py-2">
              <Link href={`/${slug}/browse/${issue.key}`} className="font-medium">
                <span className="mr-2 text-xs text-muted">{issue.key}</span>
                {issue.title}
              </Link>
            </td>
            <td className="px-3 py-2">{issue.state.name}</td>
            <td className="px-3 py-2">{PRIORITY_LABEL[issue.priority]}</td>
            <td className="px-3 py-2">{issue.assignees.map((user) => user.displayName).join(', ')}</td>
            <td className="px-3 py-2">{issue.labels.map((label) => label.name).join(', ')}</td>
            <td className="px-3 py-2">{formatDay(issue.startDate)}</td>
            <td className="px-3 py-2">{formatDay(issue.dueDate)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Gantt({
  issues,
  slug,
  scale,
  onScale,
}: {
  issues: WorkItem[]
  slug: string
  scale: 'week' | 'month' | 'quarter'
  onScale: (scale: 'week' | 'month' | 'quarter') => void
}) {
  const dated = issues.map((issue) => {
    const start = issue.startDate ? new Date(issue.startDate) : issue.dueDate ? new Date(issue.dueDate) : null
    const end = issue.dueDate ? new Date(issue.dueDate) : start
    const width =
      start && end
        ? Math.max(8, Math.min(40, (((end.getTime() - start.getTime()) / 86400000 + 1) / spanDays) * 100))
        : 8
    return { issue, start, width }
  })
  const spanDays = scale === 'week' ? 14 : scale === 'quarter' ? 90 : 35
  const origin = new Date()
  origin.setHours(0, 0, 0, 0)
  return (
    <div className="p-4">
      <div className="mb-3 flex gap-2">
        {(['week', 'month', 'quarter'] as const).map((item) => (
          <Button key={item} variant={scale === item ? 'primary' : 'secondary'} onClick={() => onScale(item)}>
            {item}
          </Button>
        ))}
      </div>
      <div className="space-y-2">
        {dated.map(({ issue, start, width }) => {
          const offset = start ? Math.round((start.getTime() - origin.getTime()) / 86400000) : 0
          const left = Math.min(90, Math.max(0, (offset / spanDays) * 100))
          return (
            <div key={issue.id} className="grid grid-cols-[220px_1fr] items-center gap-3 text-sm">
              <Link href={`/${slug}/browse/${issue.key}`} className="truncate">
                <span className="mr-2 text-xs text-muted">{issue.key}</span>
                {issue.title}
              </Link>
              <div className="relative h-6 rounded bg-canvas">
                {start ? (
                  <div className="absolute top-1 h-4 rounded bg-accent/80" style={{ left: `${left}%`, width: `${width}%` }} />
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
