import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { expect, test } from '@playwright/test'

function seedDemo(baseURL: string) {
  const stdout = execFileSync('node', ['scripts/seed-demo.mjs'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, SEED_BASE_URL: baseURL },
    encoding: 'utf8',
  })
  return JSON.parse(stdout) as {
    slug: string
    email: string
    password: string
    projectId: string
    parentKey: string
    blockedKey: string
    cycleId: string
    moduleId: string
    pageId: string
  }
}

test('seeded Clone Research demo covers view, relation, comment, cycle, module, and page', async ({ page, baseURL }) => {
  const demo = seedDemo(baseURL || 'http://localhost:3000')

  await page.goto('/login')
  await page.getByTestId('login-email').fill(demo.email)
  await page.getByTestId('login-password').fill(demo.password)
  await page.getByTestId('login-submit').click()
  await expect(page).toHaveURL(new RegExp(`/${demo.slug}`))

  await page.getByRole('link', { name: 'Projects', exact: true }).click()
  await expect(page.getByTestId('project-card').filter({ hasText: 'Clone Research' })).toBeVisible()
  await page.getByTestId('project-card').filter({ hasText: 'Clone Research' }).click()
  await expect(page.getByTestId('issue-row').filter({ hasText: 'Map competitor pricing' })).toBeVisible()
  await expect(page.getByTestId('issue-row').filter({ hasText: 'Sprint Alpha' }).first()).toBeVisible()
  await expect(page.getByTestId('issue-row').filter({ hasText: 'Competitor Teardown' }).first()).toBeVisible()

  await page.goto(`/${demo.slug}/browse/${demo.parentKey}`)
  await expect(page.getByTestId('sub-issue')).toHaveCount(2)
  await expect(page.getByTestId('relation-row')).toContainText('Blocking')
  await expect(page.getByTestId('relation-row')).toContainText(demo.blockedKey)
  await page.getByRole('button', { name: 'Comments' }).click()
  await expect(page.getByTestId('comment')).toContainText('Pricing page checked')

  await page.goto(`/${demo.slug}/projects/${demo.projectId}/cycles`)
  await expect(page.getByTestId('cycle-card').filter({ hasText: 'Sprint Alpha' })).toBeVisible()
  await page.getByTestId('cycle-tab-UPCOMING').click()
  await expect(page.getByTestId('cycle-card').filter({ hasText: 'Sprint Beta: Competitor Research' })).toBeVisible()
  await page.goto(`/${demo.slug}/projects/${demo.projectId}/cycles/${demo.cycleId}`)
  await expect(page.getByText('ACTIVE', { exact: true })).toBeVisible()
  await expect(page.getByText('Map competitor pricing').first()).toBeVisible()

  await page.goto(`/${demo.slug}/projects/${demo.projectId}/modules`)
  await expect(page.getByTestId('module-row')).toContainText('Competitor Teardown')
  await page.goto(`/${demo.slug}/projects/${demo.projectId}/modules/${demo.moduleId}`)
  await expect(page.getByText('Screenshot competitor dashboards')).toBeVisible()

  await page.goto(`/${demo.slug}/projects/${demo.projectId}/views`)
  await expect(page.getByTestId('view-card')).toContainText('High priority research')
  await expect(page.getByTestId('view-card')).toContainText('Public')
  await expect(page.getByTestId('view-card')).toContainText('Favorited')
  await page.getByTestId('view-card').click()
  await expect(page.getByTestId('issue-row').filter({ hasText: 'Map competitor pricing' })).toBeVisible()
  await expect(page.getByTestId('issue-row').filter({ hasText: 'Note packaging differences' })).toHaveCount(0)

  await page.goto(`/${demo.slug}/projects/${demo.projectId}/pages/${demo.pageId}`)
  await expect(page.getByTestId('page-title')).toHaveValue('Competitor Research Spec')

  await page.goto(`/${demo.slug}/workspace-views/all-issues`)
  await expect(page.getByTestId('workspace-issue').filter({ hasText: 'Map competitor pricing' })).toBeVisible()

  await page.goto(`/${demo.slug}/notifications`)
  await expect(page.getByText(`commented on ${demo.parentKey}`)).toBeVisible()

  await page.getByTestId('search-open').click()
  await page.getByTestId('search-input').fill('Competitor Teardown')
  await expect(page.getByTestId('search-result').filter({ hasText: 'Competitor Teardown' })).toBeVisible()
})
