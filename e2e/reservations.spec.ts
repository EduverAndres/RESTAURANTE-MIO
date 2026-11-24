import type { Browser, Page } from '@playwright/test'
import { expectNoA11yViolations } from './axe'
import { expect, loginAs, test, type SeedRole } from './fixtures'

// Table reservations, end to end: the customer books, the restaurant
// confirms from its panel, the customer sees it and cancels. Cancelling at the
// end keeps the run repeatable: a customer holds one live booking per store
// and day. Relies on the seed: la-parrilla-del-norte is on the Mediano plan
// with reservations switched on (supabase/seed.sql).

const STORE = 'la-parrilla-del-norte'

test.describe.configure({ mode: 'serial' })

async function as(browser: Browser, role: SeedRole): Promise<Page> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await loginAs(page, role)
  // The cookie banner sits over the fixed booking bar; answer it as a
  // visitor would, like table-order.spec.ts does.
  const essentials = page.getByRole('button', { name: 'Solo esenciales' })
  if (await essentials.isVisible().catch(() => false)) await essentials.click()
  return page
}

test('an anonymous visitor finds the booking page and is asked to sign in', async ({
  page,
}) => {
  await page.goto(`/t/${STORE}`)
  await page.getByRole('link', { name: 'Reservar mesa' }).first().click()
  await expect(page).toHaveURL(new RegExp(`/t/${STORE}/reservar`))
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'La Parrilla del Norte',
  )
  await expect(
    page.getByRole('link', { name: 'Inicia sesión para reservar' }),
  ).toBeVisible()
  await expectNoA11yViolations(page, 'reservation page · anonymous')
})

test('a customer books, the restaurant confirms, the customer cancels', async ({
  browser,
}) => {
  // 1. Book tomorrow at the first free time.
  const customer = await as(browser, 'customer')
  await customer.goto(`/t/${STORE}/reservar`)
  await customer.getByRole('radio', { name: /Mañana/ }).click()
  await expect(customer.getByRole('radio', { name: /Mañana/ })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await customer
    .locator('[role="radiogroup"][aria-label] [role="radio"]:not([disabled])')
    .first()
    .click()
  if (!(await customer.getByLabel('Nombre').inputValue()))
    await customer.getByLabel('Nombre').fill('Cliente de prueba')
  if (!(await customer.getByLabel('Celular').inputValue()))
    await customer.getByLabel('Celular').fill('3001234567')
  await expectNoA11yViolations(customer, 'reservation page · signed in')
  await customer.getByRole('button', { name: 'Reservar', exact: true }).click()
  await expect(
    customer.getByRole('heading', { name: 'Solicitud enviada' }),
  ).toBeVisible()

  // 2. The restaurant sees it waiting and confirms it.
  const owner = await as(browser, 'merchant')
  await owner.goto('/dashboard/reservas')
  await expect(
    owner.getByRole('heading', { name: /Por confirmar/ }),
  ).toBeVisible()
  await expectNoA11yViolations(owner, 'reservations board')
  await owner.getByRole('button', { name: 'Confirmar' }).first().click()
  await expect(owner.getByText('Reserva confirmada').first()).toBeVisible()

  // The card the customer was left on follows the answer, without a reload.
  await expect(
    customer.getByRole('heading', { name: '¡Mesa confirmada!' }),
  ).toBeVisible()

  // 3. The customer sees it confirmed, then cancels it.
  await customer.goto('/account/reservas')
  await expect(customer.getByText('Confirmada').first()).toBeVisible()
  await expectNoA11yViolations(customer, 'my reservations')
  await customer
    .getByRole('button', { name: 'Cancelar reserva' })
    .first()
    .click()
  await customer.getByRole('button', { name: 'Sí, cancelar' }).click()
  await expect(customer.getByText('Reserva cancelada').first()).toBeVisible()
})

test('the restaurant cancels and the customer’s card says so at once', async ({
  browser,
}) => {
  const customer = await as(browser, 'customer')
  await customer.goto(`/t/${STORE}/reservar`)
  await customer.getByRole('radio', { name: /Mañana/ }).click()
  await customer
    .locator('[role="radiogroup"][aria-label] [role="radio"]:not([disabled])')
    .first()
    .click()
  if (!(await customer.getByLabel('Nombre').inputValue()))
    await customer.getByLabel('Nombre').fill('Cliente de prueba')
  if (!(await customer.getByLabel('Celular').inputValue()))
    await customer.getByLabel('Celular').fill('3001234567')
  await customer.getByRole('button', { name: 'Reservar', exact: true }).click()
  await expect(
    customer.getByRole('heading', { name: 'Solicitud enviada' }),
  ).toBeVisible()
  const code = (await customer.locator('section .font-mono').textContent())!

  // The restaurant confirms it, then has to cancel it.
  const owner = await as(browser, 'merchant')
  await owner.goto('/dashboard/reservas')
  const card = owner.locator('article').filter({ hasText: code })
  await card.getByRole('button', { name: 'Confirmar' }).click()
  await expect(
    customer.getByRole('heading', { name: '¡Mesa confirmada!' }),
  ).toBeVisible()
  await card.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await owner.getByLabel('Motivo').fill('Cierre por mantenimiento')
  await owner.getByRole('button', { name: 'Cancelar reserva' }).click()
  await expect(owner.getByText('Reserva cancelada').first()).toBeVisible()

  // The customer, still on the booking page, sees why and can pick again.
  await expect(
    customer.getByRole('heading', { name: 'Reserva cancelada' }),
  ).toBeVisible()
  await expect(
    customer.getByText(/Motivo: Cierre por mantenimiento\./),
  ).toBeVisible()
  await expectNoA11yViolations(customer, 'booking card · cancelled')
  await customer.getByRole('button', { name: 'Elegir otra hora' }).click()
  await expect(
    customer.getByRole('heading', { name: '¿A qué hora?' }),
  ).toBeFocused()
})

test('the directory lists the restaurants that take reservations', async ({
  page,
}) => {
  await page.goto('/reservas')
  await expect(
    page.getByRole('link', { name: 'Reservar en La Parrilla del Norte' }),
  ).toBeVisible()
  await expectNoA11yViolations(page, 'reservation directory')
})
