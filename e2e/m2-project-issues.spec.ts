import { expect, test } from '@playwright/test'

test('create a project, then a work item visible in list, kanban, and detail', async ({ page }) => {
  const stamp = Date.now()
  const email = `ada-${stamp}@example.com`
  const slug = `lab-${stamp}`

  await page.goto('/signup')
  await page.getByTestId('signup-name').fill('Ada Lovelace')
  await page.getByTestId('signup-email').fill(email)
  await page.getByTestId('signup-password').fill('password123')
  await page.getByTestId('signup-submit').click()

  await page.getByTestId('workspace-name').fill(`Lab ${stamp}`)
  await expect(page.getByTestId('workspace-slug')).toHaveValue(slug)
  await page.getByTestId('workspace-submit').click()
  await expect(page).toHaveURL(new RegExp(`/${slug}/?$`))

  await page.getByRole('link', { name: 'Projects', exact: true }).click()
  await expect(page.getByText('No projects yet')).toBeVisible()
  await page.getByTestId('add-project').click()
  await page.getByTestId('project-name').fill('Clone Research')
  await page.getByTestId('project-identifier').fill('CLONE')
  await page.getByTestId('project-submit').click()

  await expect(page).toHaveURL(/\/projects\/[^/]+\/issues/)
  await page.getByTestId('add-work-item').click()
  await page.getByTestId('issue-title').fill('Survey competitors')
  await page.getByTestId('issue-submit').click()
  await expect(page.getByTestId('issue-row').filter({ hasText: 'CLONE-1' })).toBeVisible()

  await page.getByTestId('layout-kanban').click()
  await expect(page.getByTestId('issue-card').filter({ hasText: 'Survey competitors' })).toBeVisible()
  await page.getByTestId('issue-card').filter({ hasText: 'Survey competitors' }).click()
  await expect(page).toHaveURL(new RegExp(`/${slug}/browse/CLONE-1`))
  await expect(page.getByTestId('detail-state')).toContainText('Backlog')

  await page.getByTestId('sub-issue-title').fill('Write the spec')
  await page.getByTestId('sub-issue-submit').click()
  await expect(page.getByTestId('sub-issue')).toContainText('CLONE-2')

  await page.getByTestId('relation-key').fill('CLONE-2')
  await page.getByTestId('relation-submit').click()
  await expect(page.getByTestId('relation-row')).toContainText('BLOCKS')
  await expect(page.getByTestId('relation-row')).toContainText('CLONE-2')
})
