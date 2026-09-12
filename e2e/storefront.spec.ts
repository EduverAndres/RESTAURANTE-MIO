import { expectNoA11yViolations } from './axe'
import { expect, test } from './fixtures'

// Seeded store used to check the menu and cart without relying on the exact
// set of stores the home page happens to show (see supabase/seed.sql).
const STORE_SLUG = 'verde-bowl'
const STORE_NAME = 'Verde Bowl'

test('the home page lists stores that link to their storefront', async ({
  page,
}) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: 'Restaurantes para pedir hoy',
    }),
  ).toBeVisible()

  const storeLinks = page.getByRole('link', { name: /^Ver / })
  await expect(storeLinks.first()).toBeVisible()

  await expectNoA11yViolations(page, 'marketplace home')

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
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    STORE_NAME,
  )

  const productButtons = page.getByRole('button', { name: /^Ver / })
  await expect(productButtons.first()).toBeVisible()

  await expectNoA11yViolations(page, 'storefront · menu')

  await productButtons.first().click()

  const drawer = page.getByRole('dialog')
  await expect(drawer).toBeVisible()

  await expectNoA11yViolations(page, 'storefront · product drawer')

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

  await expectNoA11yViolations(page, 'storefront · cart sheet')
})

test('the focus trap in the cart sheet returns focus to its trigger', async ({
  page,
}) => {
  await page.goto(`/t/${STORE_SLUG}`)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    STORE_NAME,
  )

  const productButtons = page.getByRole('button', { name: /^Ver / })
  await expect(productButtons.first()).toBeVisible()
  await productButtons.first().click()
  const drawer = page.getByRole('dialog')
  const requiredGroups = drawer.locator('fieldset', { hasText: 'Obligatorio' })
  const count = await requiredGroups.count()
  for (let index = 0; index < count; index += 1) {
    await requiredGroups.nth(index).getByRole('radio').first().click()
  }
  await drawer.getByRole('button', { name: /^Agregar · / }).click()
  await expect(drawer).toBeHidden()

  const fab = page.getByRole('button', { name: /Abrir carrito/ })
  await fab.click()
  const cart = page.getByRole('dialog', { name: 'Tu pedido' })
  await expect(cart).toBeVisible()

  // Focus must be inside the sheet, not left behind on the page below it.
  await expect(cart).toContainText('Tu pedido')
  const focusedInside = await page.evaluate(() => {
    const dialog = document.querySelector('[data-slot="sheet-content"]')
    return Boolean(dialog && dialog.contains(document.activeElement))
  })
  expect(focusedInside).toBe(true)

  // Escape closes, and focus goes back to the button that opened it.
  await page.keyboard.press('Escape')
  await expect(cart).toBeHidden()
  await expect(fab).toBeFocused()
})

test('the accessibility preferences reshape the page and survive a reload', async ({
  page,
}) => {
  await page.goto('/')

  const html = page.locator('html')
  const baseFontSize = await html.evaluate(
    (node) => getComputedStyle(node).fontSize,
  )

  // Extra-large text.
  await page.getByRole('button', { name: 'Opciones de accesibilidad' }).click()
  await page.getByRole('menuitemradio', { name: 'Extra grande' }).click()
  await expect(html).toHaveAttribute('data-text-size', 'xlarge')
  const largeFontSize = await html.evaluate(
    (node) => getComputedStyle(node).fontSize,
  )
  expect(
    parseFloat(largeFontSize),
    'extra-large text must actually enlarge the root font size',
  ).toBeGreaterThan(parseFloat(baseFontSize))

  // High contrast forces a visible border on controls that have none by default.
  await page.getByRole('button', { name: 'Opciones de accesibilidad' }).click()
  await page.getByRole('menuitemcheckbox', { name: 'Contraste alto' }).click()
  await expect(html).toHaveAttribute('data-contrast', 'high')
  const borderWidth = await page
    .getByRole('link', { name: 'Inicio' })
    .first()
    .evaluate((node) => getComputedStyle(node).borderTopWidth)
  expect(
    parseFloat(borderWidth),
    'high contrast must draw a real border, not only darker text',
  ).toBeGreaterThan(0)

  // Reduced motion.
  await page.getByRole('button', { name: 'Opciones de accesibilidad' }).click()
  await page
    .getByRole('menuitemcheckbox', { name: 'Reducir animaciones' })
    .click()
  await expect(html).toHaveAttribute('data-motion', 'reduce')

  // The choices are still in force on the next visit, and applied before the
  // first paint by the inline script rather than after hydration.
  await page.reload()
  await expect(html).toHaveAttribute('data-text-size', 'xlarge')
  await expect(html).toHaveAttribute('data-contrast', 'high')
  await expect(html).toHaveAttribute('data-motion', 'reduce')

  // The most demanding combination still has to pass the audit.
  await expectNoA11yViolations(
    page,
    'marketplace home · xlarge + high contrast',
  )
})
