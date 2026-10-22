export const WORKSPACE_ROLES = ['ADMIN', 'MEMBER', 'GUEST'] as const
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number]

export const PROJECT_ROLES = ['ADMIN', 'MEMBER', 'GUEST'] as const
export type ProjectRole = (typeof PROJECT_ROLES)[number]

export const PRIORITIES = ['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE'] as const
export type Priority = (typeof PRIORITIES)[number]

export const STATE_GROUPS = [
  'BACKLOG',
  'UNSTARTED',
  'STARTED',
  'COMPLETED',
  'CANCELLED',
] as const
export type StateGroup = (typeof STATE_GROUPS)[number]

export const ISSUE_RELATION_TYPES = [
  'RELATES_TO',
  'BLOCKS',
  'BLOCKED_BY',
  'DUPLICATE_OF',
] as const
export type IssueRelationType = (typeof ISSUE_RELATION_TYPES)[number]

export const CYCLE_STATUSES = ['ACTIVE', 'UPCOMING', 'COMPLETED'] as const
export const MODULE_STATUSES = [
  'BACKLOG',
  'PLANNED',
  'IN_PROGRESS',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
] as const

export const LAYOUTS = ['LIST', 'KANBAN', 'CALENDAR', 'SPREADSHEET', 'GANTT'] as const
export type Layout = (typeof LAYOUTS)[number]

export const PAGE_ACCESS = ['PUBLIC', 'PRIVATE'] as const
export type PageAccess = (typeof PAGE_ACCESS)[number]

export const INTAKE_STATUSES = ['PENDING', 'ACCEPTED', 'DECLINED'] as const

export const RESERVED_SLUGS = [
  'login',
  'signup',
  'create-workspace',
  'invite',
  'settings',
  'api',
  'admin',
  'assets',
  '_next',
] as const

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const DEFAULT_STATES: Array<{
  name: string
  group: StateGroup
  color: string
  isDefault: boolean
}> = [
  { name: 'Backlog', group: 'BACKLOG', color: '#60646c', isDefault: true },
  { name: 'Todo', group: 'UNSTARTED', color: '#60646c', isDefault: false },
  { name: 'In Progress', group: 'STARTED', color: '#f59e0b', isDefault: false },
  { name: 'Done', group: 'COMPLETED', color: '#16a34a', isDefault: false },
  { name: 'Cancelled', group: 'CANCELLED', color: '#a1a1aa', isDefault: false },
]

export const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']

export const TIMEZONES = [
  'UTC',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Kolkata',
  'Australia/Sydney',
]

export function isReservedSlug(slug: string): boolean {
  return (RESERVED_SLUGS as readonly string[]).includes(slug)
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}
