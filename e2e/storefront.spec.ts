import { expect, test } from './fixtures'

// Seeded store used to check the menu and cart without relying on the exact
// set of stores the home page happens to show (see supabase/seed.sql).
const STORE_SLUG = 'verde-bowl'
const STORE_NAME = 'Verde Bowl'

test('the home page lists stores that link to their storefront', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { level: 2, name: 'Restaurantes para pedir hoy' }),
  ).toBeVisible()

  const storeLinks = page.getByRole('link', { name: /^Ver / })
  await expect(storeLinks.first()).toBeVisible()

  const label = await storeLinks.first().getAttribute('aria-label')
  const storeName = label?.replace(/^Ver /, '') ?? ''
  await storeLinks.first().click()

  await page.waitForURL(/\/t\/[^/]+$/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(storeName)
})

test('a store page renders its menu and opens the cart after adding an item', async ({
  page,
}) => {
  await page.goto(`/t/${STORE_SLUG}`)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(STORE_NAME)

  const productButtons = page.getByRole('button', { name: /^Ver / })
  await expect(productButtons.first()).toBeVisible()
  await productButtons.first().click()

  const drawer = page.getByRole('dialog')
  await expect(drawer).toBeVisible()
  const requiredGroups = drawer.locator('fieldset', { hasText: 'Obligatorio' })
  const count = await requiredGroups.count()
  for (let index = 0; index < count; index += 1) {
    await requiredGroups.nth(index).getByRole('radio').first().click()
  }
  await drawer.getByRole('button', { name: /^Agregar · / }).click()
  await expect(drawer).toBeHidden()

  await page.getByRole('button', { name: /Abrir carrito/ }).click()
  const cart = page.getByRole('dialog', { name: 'Tu pedido' })
  await expect(cart).toContainText('1 producto')
})
