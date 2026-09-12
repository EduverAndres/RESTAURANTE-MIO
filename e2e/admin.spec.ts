import { expectNoA11yViolations } from './axe'
import { expect, loginAs, test } from './fixtures'

test.describe('admin area', () => {
  test.use({ role: 'admin' })

  test('an admin reaches /admin/stores and sees the seeded stores', async ({
    page,
  }) => {
    await page.goto('/admin/stores')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Tiendas' }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'La Parrilla del Norte' }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Verde Bowl' })).toBeVisible()

    await expectNoA11yViolations(page, 'admin · stores')
  })
})

test('a non-admin visiting /admin is redirected to the home page', async ({
  page,
}) => {
  await loginAs(page, 'merchant')
  await page.goto('/admin')
  await page.waitForURL((url) => url.pathname === '/')
})
