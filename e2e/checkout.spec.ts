import { expectNoA11yViolations } from './axe'
import { loginAs, expect, test } from './fixtures'

// Seeded store used for the pickup + mock-card happy path (see supabase/seed.sql).
const STORE_SLUG = 'verde-bowl'

test('a customer can order for pickup and land on the tracking page', async ({
  page,
}) => {
  await loginAs(page, 'customer')

  await page.goto(`/t/${STORE_SLUG}`)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Verde Bowl',
  )

  // Open the first product and satisfy any required option groups.
  const productButtons = page.getByRole('button', { name: /^Ver / })
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

  // Cart FAB shows the item and leads to the checkout.
  await page.getByRole('button', { name: /Abrir carrito/ }).click()
  const cart = page.getByRole('dialog', { name: 'Tu pedido' })
  await expect(cart).toContainText('1 producto')
  await cart.getByRole('link', { name: /Ir a pagar/ }).click()
  await page.waitForURL('**/checkout')

  await expectNoA11yViolations(page, 'checkout')

  // Pickup avoids the delivery-radius rule; the mock card approves instantly.
  await page.getByRole('radio', { name: /Recoger/ }).click()
  await page.getByRole('radio', { name: /Tarjeta de prueba/ }).click()
  await page.getByRole('button', { name: /^Pagar/ }).click()

  await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByText('Nuevo').first()).toBeVisible()
  // Anchored so the timeline copy ("Listo para salir o para recoger.") cannot match.
  await expect(page.getByText(/^Para recoger ·/)).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Cancelar pedido' }),
  ).toBeVisible()

  // The celebration only fires for the person who just paid: the checkout
  // hands the order id over in session storage and the tracking page spends
  // it once.
  await expect(page.getByText('¡Pedido confirmado!')).toBeVisible()
  await expectNoA11yViolations(page, 'order tracking · just placed')

  await page.reload()
  await expect(page.getByText('¡Pedido confirmado!')).toHaveCount(0)
})

test('protected checkout redirects anonymous visitors to login', async ({
  page,
}) => {
  await page.goto('/checkout')
  await page.waitForURL(/\/login\?next=%2Fcheckout/)

  // The login form is the narrowest gate in the product: audit it here rather
  // than in a spec of its own.
  await expect(page.getByLabel('Correo electrónico')).toBeVisible()
  await expectNoA11yViolations(page, 'login')
})
