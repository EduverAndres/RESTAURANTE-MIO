import type { Browser, Page } from '@playwright/test'
import { expectNoA11yViolations } from './axe'
import { PASSWORD, expect, loginAs, test, type SeedRole } from './fixtures'

// Company accounts, end to end: Cerquita approves the company, its admin
// invites an employee by link, the employee joins, pays an order with the
// company account, and the restaurant sees who to invoice.
//
// Needs CORPORATE_ACCOUNTS_ENABLED=true on the server and the seed company
// (supabase/seed.sql): "Constructora del Caribe S.A.S.", pending, with
// cliente2@tienda.app as its admin. The run puts things back at the end —
// the restaurant rejects the order (which frees the credit), the admin takes
// the employee off the team and Cerquita suspends the company — so it can be
// repeated: a suspended company is reactivated with the same dialog.

const COMPANY = 'Constructora del Caribe'
const LEGAL_NAME = 'Constructora del Caribe S.A.S.'
const NIT = '900.123.456-8'
const STORE = 'la-parrilla-del-norte'
const COMPANY_ADMIN = 'cliente2@tienda.app'
const EMPLOYEE = 'cliente3@tienda.app'
const EMPLOYEE_NAME = 'Valentina Ruiz'

test.describe.configure({ mode: 'serial' })

async function answerCookies(page: Page) {
  const essentials = page.getByRole('button', { name: 'Solo esenciales' })
  if (await essentials.isVisible().catch(() => false)) await essentials.click()
}

async function signIn(browser: Browser, who: SeedRole | string): Promise<Page> {
  const context = await browser.newContext()
  const page = await context.newPage()
  if (who.includes('@')) {
    await page.goto('/login')
    await page.getByLabel('Correo electrónico').fill(who)
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD)
    await page.locator('#login-accept').check()
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForURL((url) => !url.pathname.startsWith('/login'))
  } else {
    await loginAs(page, who as SeedRole)
  }
  await answerCookies(page)
  return page
}

test('the companies page explains the account and passes axe', async ({
  page,
}) => {
  await page.goto('/empresas')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'en una sola cuenta',
  )
  await expect(
    page.getByRole('heading', { name: '¿Cuánto presupuesto necesitas?' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: /Crear cuenta de empresa/ }).first(),
  ).toHaveAttribute('href', '/empresa/registro')
  await answerCookies(page)
  await expectNoA11yViolations(page, 'companies landing')
})

test('approve, invite, join, pay with the company and invoice it', async ({
  browser,
}) => {
  test.setTimeout(300_000)

  // 1. Cerquita approves the company with a credit line.
  const admin = await signIn(browser, 'admin')
  await admin.goto('/admin/companies')
  const row = admin.getByRole('row', { name: new RegExp(COMPANY) })
  await expect(row).toBeVisible()
  const approve = row.getByRole('button', {
    name: new RegExp(`^(Aprobar|Reactivar) ${COMPANY}`),
  })
  if (await approve.isVisible().catch(() => false)) {
    await approve.click()
    const dialog = admin.getByRole('dialog')
    await dialog.getByLabel('Cupo de crédito').fill('2.000.000')
    await dialog.getByLabel('Tope de propina (%)').fill('10')
    await dialog.getByRole('button', { name: /^(Aprobar|Reactivar)$/ }).click()
    await expect(admin.getByText('Empresa aprobada.')).toBeVisible()
  }
  await expect(row.getByText('Activa')).toBeVisible()

  // 2. The company's admin invites an employee by link.
  const owner = await signIn(browser, COMPANY_ADMIN)
  await owner.goto('/empresa/equipo')
  await expect(
    owner.getByRole('heading', { level: 1, name: 'Equipo' }),
  ).toBeVisible()
  // A previous, interrupted run may have left the employee on the team.
  const leftover = owner.getByRole('button', {
    name: `Retirar a ${EMPLOYEE_NAME}`,
  })
  if (await leftover.isVisible().catch(() => false)) {
    await leftover.click()
    await owner.getByRole('button', { name: 'Sí, retirar' }).click()
    await expect(owner.getByText(/ya no hace parte del equipo/)).toBeVisible()
  }
  await expectNoA11yViolations(owner, 'company team')
  await owner.getByLabel(/Presupuesto mensual por persona/).fill('300.000')
  await owner.getByLabel(/Tope por pedido/).fill('150.000')
  await owner
    .getByRole('button', { name: 'Crear enlace de invitación' })
    .click()
  const linkField = owner.getByLabel('Enlace de invitación')
  await expect(linkField).toHaveValue(/\/empresa\/unirse\//)
  const link = await linkField.inputValue()
  await expect(
    owner.getByRole('link', { name: 'Compartir por WhatsApp' }),
  ).toHaveAttribute('href', /^https:\/\/wa\.me\/\?text=/)

  // 3. The employee opens the link and joins.
  const employee = await signIn(browser, EMPLOYEE)
  await employee.goto(new URL(link).pathname)
  await employee.getByRole('button', { name: `Unirme a ${COMPANY}` }).click()
  await employee.waitForURL('**/empresa')
  await expect(
    employee.getByRole('heading', { level: 1, name: 'Tu cuenta de empresa' }),
  ).toBeVisible()
  await expect(employee.getByText('Disponible para pedir')).toBeVisible()
  await expectNoA11yViolations(employee, 'company summary · employee')

  // 4. The employee orders and pays with the company account.
  await employee.goto(`/t/${STORE}`)
  await employee.getByRole('button', { name: /^Ver Baby beef/ }).click()
  const drawer = employee.getByRole('dialog')
  await drawer.getByRole('button', { name: /^Agregar · / }).click()
  await expect(drawer).toBeHidden()
  await employee.getByRole('button', { name: /Abrir carrito/ }).click()
  await employee
    .getByRole('dialog', { name: 'Tu pedido' })
    .getByRole('link', { name: /Ir a pagar/ })
    .click()
  await employee.waitForURL('**/checkout')
  await employee.getByRole('radio', { name: /Recoger/ }).click()
  await employee.getByRole('radio', { name: /Sin propina/ }).click()
  await employee
    .getByRole('radio', { name: new RegExp(`Cuenta de empresa — ${COMPANY}`) })
    .click()
  await employee.getByLabel(/Motivo o centro de costo/).fill('Almuerzo de obra')
  await expectNoA11yViolations(employee, 'checkout · company account')
  await employee
    .getByRole('button', { name: /^Pagar .* con la cuenta de empresa$/ })
    .click()
  await employee.waitForURL(/\/orders\/[0-9a-f-]{36}$/)
  await expect(
    employee.getByText(/Para recoger · Cuenta de empresa/),
  ).toBeVisible()
  const shortCode = (
    await employee.locator('header p.font-mono').first().innerText()
  ).replace('#', '')

  // 5. The restaurant sees it marked "do not collect" and who to invoice.
  const merchant = await signIn(browser, 'merchant')
  await merchant.goto('/dashboard')
  const card = merchant.getByRole('article', { name: `Pedido #${shortCode}` })
  await expect(card.getByText('Empresa · no cobrar')).toBeVisible()
  await card.getByRole('button', { name: /Datos para facturar/ }).click()
  const billing = merchant.getByRole('dialog')
  await expect(billing.getByText(LEGAL_NAME)).toBeVisible()
  await expect(billing.getByText(NIT)).toBeVisible()
  await expect(billing.getByText('Almuerzo de obra')).toBeVisible()
  await expectNoA11yViolations(merchant, 'merchant board · billing data', {
    include: '[role="dialog"]',
  })
  await merchant.keyboard.press('Escape')

  // 6. Put things back so the run can be repeated.
  await card.getByRole('button', { name: 'Rechazar' }).click()
  await merchant.getByRole('button', { name: 'Sí, rechazar' }).click()
  await expect(card).toHaveCount(0)

  await owner.goto('/empresa/equipo')
  await owner
    .getByRole('button', { name: `Retirar a ${EMPLOYEE_NAME}` })
    .click()
  await owner.getByRole('button', { name: 'Sí, retirar' }).click()
  await expect(owner.getByText(/ya no hace parte del equipo/)).toBeVisible()

  await admin.goto('/admin/companies')
  await row.getByRole('button', { name: `Suspender ${COMPANY}` }).click()
  await admin
    .getByRole('dialog')
    .getByLabel('Motivo')
    .fill('Fin de la prueba e2e')
  await admin
    .getByRole('dialog')
    .getByRole('button', { name: 'Suspender' })
    .click()
  await expect(admin.getByText('Empresa suspendida.')).toBeVisible()
})
