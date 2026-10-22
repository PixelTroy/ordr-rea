import { pathToFileURL } from 'node:url'

const BASE = (process.env.SEED_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')

const EMAIL = 'demo@ordr.local'
const PASSWORD = 'password123'
const GRACE_EMAIL = 'grace@ordr.local'
const SLUG = 'gootroy'

function jar() {
  const cookies = new Map()
  return {
    store(response) {
      const list = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : []
      for (const cookie of list) {
        const [pair] = cookie.split(';')
        const eq = pair.indexOf('=')
        if (eq > 0) cookies.set(pair.slice(0, eq), pair.slice(eq + 1))
      }
    },
    header() {
      return [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ')
    },
  }
}

async function api(cookies, path, init = {}) {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
  if (cookies.header()) headers.set('cookie', cookies.header())
  const response = await fetch(`${BASE}${path}`, { ...init, headers })
  cookies.store(response)
  const text = await response.text()
  const body = text ? JSON.parse(text) : null
  if (!response.ok) {
    const message = body && body.message ? JSON.stringify(body.message) : text
    throw new Error(`${response.status} ${path} ${message}`)
  }
  return body
}

async function session(email, displayName) {
  const cookies = jar()
  const signup = await fetch(`${BASE}/api/v1/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, displayName }),
  })
  cookies.store(signup)
  if (signup.status === 201 || signup.status === 200) {
    const body = JSON.parse(await signup.text())
    return { cookies, user: body.user }
  }
  await signup.text()
  const login = await api(cookies, '/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  return { cookies, user: login.user }
}

function doc(text) {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }
}

export async function seedDemo() {
  const ada = await session(EMAIL, 'Ada Lovelace')
  const existing = await api(ada.cookies, '/api/v1/workspaces')
  if (existing.workspaces.some((workspace) => workspace.slug === SLUG)) {
    await api(ada.cookies, `/api/v1/workspaces/${SLUG}`, {
      method: 'DELETE',
      body: JSON.stringify({ confirmSlug: SLUG }),
    })
  }
  await api(ada.cookies, '/api/v1/workspaces', {
    method: 'POST',
    body: JSON.stringify({ name: 'Gootroy', slug: SLUG, companySize: '11-50' }),
  })
  const project = await api(ada.cookies, `/api/v1/workspaces/${SLUG}/projects`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Clone Research',
      identifier: 'CLONE',
      description: 'Competitor research notes for the clone.',
      emoji: '🔬',
    }),
  })
  const projectId = project.project.id
  const detail = await api(ada.cookies, `/api/v1/workspaces/${SLUG}/projects/${projectId}`)
  const stateId = Object.fromEntries(detail.project.states.map((state) => [state.name, state.id]))
  const label = await api(ada.cookies, `/api/v1/workspaces/${SLUG}/projects/${projectId}/labels`, {
    method: 'POST',
    body: JSON.stringify({ name: 'research', color: '#3e4db5' }),
  })
  const labelId = label.label.id

  const cycle = await api(ada.cookies, `/api/v1/workspaces/${SLUG}/projects/${projectId}/cycles`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Sprint Alpha',
      description: 'Active research sprint.',
      startDate: '2026-10-19',
      endDate: '2026-10-29',
    }),
  })
  const upcoming = await api(ada.cookies, `/api/v1/workspaces/${SLUG}/projects/${projectId}/cycles`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Sprint Beta: Competitor Research',
      description: 'Follow-up after Sprint Alpha.',
      startDate: '2026-10-30',
      endDate: '2026-11-12',
    }),
  })
  const module = await api(ada.cookies, `/api/v1/workspaces/${SLUG}/projects/${projectId}/modules`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Competitor Teardown',
      description: 'Break down public product surfaces.',
      status: 'IN_PROGRESS',
      startDate: '2026-10-19',
      targetDate: '2026-11-12',
    }),
  })

  async function issue(payload) {
    const created = await api(ada.cookies, `/api/v1/workspaces/${SLUG}/projects/${projectId}/issues`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return created.issue
  }

  const pricing = await issue({
    title: 'Map competitor pricing',
    description: 'Capture public plans and limits.',
    priority: 'HIGH',
    stateId: stateId.Backlog,
    assigneeIds: [ada.user.id],
    labelIds: [labelId],
    startDate: '2026-10-20',
    dueDate: '2026-10-28',
    cycleId: cycle.cycle.id,
    moduleIds: [module.module.id],
  })
  const matrix = await issue({
    title: 'Capture public feature matrix',
    priority: 'MEDIUM',
    stateId: stateId.Backlog,
    parentId: pricing.id,
    assigneeIds: [ada.user.id],
  })
  const packaging = await issue({
    title: 'Note packaging differences',
    priority: 'LOW',
    stateId: stateId.Backlog,
    parentId: pricing.id,
  })
  const onboarding = await issue({
    title: 'Review onboarding flow',
    priority: 'HIGH',
    stateId: stateId.Todo,
    assigneeIds: [ada.user.id],
    labelIds: [labelId],
    startDate: '2026-10-21',
    dueDate: '2026-10-27',
    cycleId: cycle.cycle.id,
    moduleIds: [module.module.id],
  })
  await issue({
    title: 'Draft comparison outline',
    priority: 'NONE',
    stateId: stateId.Todo,
    startDate: '2026-10-22',
    dueDate: '2026-10-26',
  })
  const screenshots = await issue({
    title: 'Screenshot competitor dashboards',
    priority: 'MEDIUM',
    stateId: stateId['In Progress'],
    assigneeIds: [ada.user.id],
    moduleIds: [module.module.id],
    startDate: '2026-10-22',
    dueDate: '2026-10-24',
  })
  await issue({
    title: 'Write teardown notes',
    priority: 'HIGH',
    stateId: stateId['In Progress'],
    labelIds: [labelId],
    cycleId: cycle.cycle.id,
  })
  await issue({
    title: 'Publish research brief',
    priority: 'HIGH',
    stateId: stateId.Done,
    assigneeIds: [ada.user.id],
  })
  await issue({
    title: 'Archive outdated scan',
    priority: 'LOW',
    stateId: stateId.Cancelled,
  })
  await issue({
    title: 'Park an unfinished interview guide',
    description: 'Saved as a draft.',
    priority: 'MEDIUM',
    isDraft: true,
  })

  await api(ada.cookies, `/api/v1/workspaces/${SLUG}/projects/${projectId}/issues/${pricing.id}/relations`, {
    method: 'POST',
    body: JSON.stringify({ type: 'BLOCKS', relatedKey: screenshots.key }),
  })

  const view = await api(ada.cookies, `/api/v1/workspaces/${SLUG}/projects/${projectId}/views`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'High priority research',
      description: 'Priority is High',
      access: 'PUBLIC',
      layout: 'LIST',
      filters: { priority: 'HIGH' },
    }),
  })
  await api(ada.cookies, `/api/v1/workspaces/${SLUG}/projects/${projectId}/views/${view.view.id}/favorite`, { method: 'POST' })

  const page = await api(ada.cookies, `/api/v1/workspaces/${SLUG}/pages`, {
    method: 'POST',
    body: JSON.stringify({
      title: 'Competitor Research Spec',
      projectId,
      access: 'PUBLIC',
      contentJson: doc('Scope: public pricing, onboarding, and dashboard screenshots.'),
    }),
  })

  await api(ada.cookies, `/api/v1/workspaces/${SLUG}/projects/${projectId}/intake`, {
    method: 'POST',
    body: JSON.stringify({ title: 'Add a mobile pricing screenshot', description: 'From the marketing site.' }),
  })

  const old = await api(ada.cookies, `/api/v1/workspaces/${SLUG}/projects`, {
    method: 'POST',
    body: JSON.stringify({ name: 'Old Scan', identifier: 'OLD', emoji: '📦' }),
  })
  await api(ada.cookies, `/api/v1/workspaces/${SLUG}/projects/${old.project.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ archived: true }),
  })

  const invite = await api(ada.cookies, `/api/v1/workspaces/${SLUG}/invites`, {
    method: 'POST',
    body: JSON.stringify({ email: GRACE_EMAIL, role: 'MEMBER' }),
  })
  const token = String(invite.acceptUrl).split('/').pop()
  const grace = await session(GRACE_EMAIL, 'Grace Hopper')
  await api(grace.cookies, `/api/v1/invites/${token}/accept`, { method: 'POST' })
  await api(grace.cookies, `/api/v1/workspaces/${SLUG}/projects/${projectId}/issues/${pricing.id}/comments`, {
    method: 'POST',
    body: JSON.stringify({
      bodyJson: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Pricing page checked. ' },
              { type: 'mention', attrs: { id: ada.user.id, label: 'Ada Lovelace' } },
              { type: 'text', text: ' can confirm the annual plan.' },
            ],
          },
        ],
      },
    }),
  })

  return {
    slug: SLUG,
    email: EMAIL,
    password: PASSWORD,
    projectId,
    parentKey: pricing.key,
    blockedKey: screenshots.key,
    childKey: matrix.key,
    extraChildKey: packaging.key,
    cycleId: cycle.cycle.id,
    upcomingCycleId: upcoming.cycle.id,
    moduleId: module.module.id,
    viewId: view.view.id,
    pageId: page.page.id,
    onboardingKey: onboarding.key,
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedDemo()
    .then((demo) => {
      console.log(JSON.stringify(demo, null, 2))
    })
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
