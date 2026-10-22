export type BriefUser = {
  id: string
  displayName: string
  email: string
  avatarColor: string
}

export type WorkState = {
  id: string
  name: string
  color: string
  group: string
  sequence: number
  isDefault: boolean
}

export type WorkLabel = {
  id: string
  name: string
  color: string
}

export type ProjectCard = {
  id: string
  name: string
  identifier: string
  emoji: string
  coverColor: string
  network: 'PUBLIC' | 'PRIVATE'
  description: string
  archivedAt: string | null
  createdAt: string
  lead: BriefUser | null
  joined: boolean
  memberCount: number
}

export type ProjectMember = {
  id: string
  role: 'ADMIN' | 'MEMBER' | 'GUEST'
  joinedAt: string
  user: BriefUser
}

export type ProjectDetail = ProjectCard & {
  timezone: string
  cyclesEnabled: boolean
  modulesEnabled: boolean
  viewsEnabled: boolean
  pagesEnabled: boolean
  intakeEnabled: boolean
  timeTrackingEnabled: boolean
  estimateType: 'NONE' | 'POINTS' | 'CATEGORIES'
  estimateScale: string[] | null
  defaultAssignee: BriefUser | null
  states: WorkState[]
  labels: WorkLabel[]
  members: ProjectMember[]
  canWrite: boolean
  issueCount: number
}

export type WorkItem = {
  id: string
  key: string
  sequenceId: number
  title: string
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
  state: { id: string; name: string; color: string; group: string }
  assignees: BriefUser[]
  labels: WorkLabel[]
  parent: { id: string; sequenceId: number; title: string; key: string } | null
  subIssueCount: number
  subIssueDone: number
  linkCount: number
  relationCount: number
  attachmentCount: number
  startDate: string | null
  dueDate: string | null
  sortOrder: number
  estimate: string | null
  isDraft: boolean
  archivedAt: string | null
  createdBy: BriefUser
  createdAt: string
  updatedAt: string
  projectId?: string
  projectName?: string
  description?: string
}

export const PRIORITY_LABEL: Record<WorkItem['priority'], string> = {
  URGENT: 'Urgent',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  NONE: 'None',
}

export const PRIORITY_COLOR: Record<WorkItem['priority'], string> = {
  URGENT: '#dc2626',
  HIGH: '#ea580c',
  MEDIUM: '#ca8a04',
  LOW: '#2563eb',
  NONE: '#a1a1aa',
}

export function dayKey(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

export function formatDay(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function suggestIdentifier(name: string) {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const raw = (words.length > 1 ? words.map((word) => word[0]).join('') : words[0] || 'PR').replace(/[^A-Z0-9]/g, '')
  const trimmed = raw.slice(0, 5)
  const withLetter = /^[A-Z]/.test(trimmed) ? trimmed : `P${trimmed}`
  return withLetter.padEnd(2, 'X').slice(0, 5)
}
