import { expect, test } from '@playwright/test'

test('sign up, create a workspace, invite a member, and accept', async ({ browser }) => {
  const stamp = Date.now()
  const emailA = `ada-${stamp}@example.com`
  const emailB = `grace-${stamp}@example.com`
  const slug = `lab-${stamp}`

  const contextA = await browser.newContext()
  const page = await contextA.newPage()
  await page.goto('/signup')
  await page.getByTestId('signup-name').fill('Ada Lovelace')
  await page.getByTestId('signup-email').fill(emailA)
  await page.getByTestId('signup-password').fill('password123')
  await page.getByTestId('signup-submit').click()

  await expect(page.getByTestId('workspace-name')).toBeVisible()
  await page.getByTestId('workspace-name').fill(`Lab ${stamp}`)
  await expect(page.getByTestId('workspace-slug')).toHaveValue(slug)
  await page.getByTestId('workspace-submit').click()
  await expect(page).toHaveURL(new RegExp(`/${slug}/?$`))

  await page.getByRole('link', { name: 'Projects', exact: true }).click()
  await expect(page.getByText('No projects yet')).toBeVisible()

  await page.goto(`/${slug}/settings/members`)
  await page.getByTestId('add-member').click()
  await page.getByTestId('invite-email').fill(emailB)
  await page.getByTestId('invite-role').selectOption('MEMBER')
  await page.getByTestId('invite-submit').click()
  const link = await page.getByTestId('invite-link').inputValue()
  expect(link).toContain('/invite/')

  const contextB = await browser.newContext()
  const pageB = await contextB.newPage()
  await pageB.goto(link)
  await pageB.getByTestId('invite-signup').click()
  await pageB.getByTestId('signup-name').fill('Grace Hopper')
  await pageB.getByTestId('signup-password').fill('password123')
  await pageB.getByTestId('signup-submit').click()
  await pageB.getByTestId('accept-invite').click()
  await expect(pageB).toHaveURL(new RegExp(`/${slug}`))

  await page.reload()
  await expect(page.getByText(emailB)).toBeVisible()
  await contextA.close()
  await contextB.close()
})
