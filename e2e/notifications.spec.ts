import type { Browser, Page } from '@playwright/test'
import { expectNoA11yViolations } from './axe'
import { expect, loginAs, test, type SeedRole } from './fixtures'

// Live notifications, end to end, with two screens already open and never
// reloaded: the restaurant asks for a sponsored spot and the admin's bell
// rings with it at once (and the admin's list shows the request); the admin
// approves it and the restaurant's campaign card turns "Al aire" by itself.
// Relies on the seed's la-parrilla-del-norte, owned by owner1@tienda.app,
// and cleans its campaign up at both ends so the run is repeatable.

const STORE = 'La Parrilla del Norte'
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
/** Realtime delivery plus a server refresh, on a dev server. */
const LIVE = { timeout: 20_000 }

test.describe.configure({ mode: 'serial' })

const CONSENT = {
  name: 'tienda_cookie_consent',
  value: encodeURIComponent(
    JSON.stringify({
      v: 1,
      analytics: false,
      marketing: false,
      at: new Date().toISOString(),
    }),
  ),
  url: BASE_URL,
}

async function open(browser: Browser, role: SeedRole): Promise<Page> {
  const context = await browser.newContext()
  await context.addCookies([CONSENT])
  const page = await context.newPage()
  await loginAs(page, role)
  return page
}

/** Pages with a live socket never reach `networkidle`; let React hydrate. */
async function settle(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'load' })
  await page.waitForTimeout(3000)
}

/** Ends or rejects whatever a previous run left behind. */
async function clearLeftovers(admin: Page): Promise<void> {
  await settle(admin, '/admin/publicidad')
  for (const action of ['Terminar', 'Rechazar'] as const) {
    const button = admin.getByRole('button', {
      name: `${action} la campaña de ${STORE}`,
    })
    while ((await button.count()) > 0) {
      await button.first().click()
      if (action === 'Terminar') {
        await admin.getByRole('button', { name: 'Sí, terminar' }).click()
      } else {
        await admin.getByLabel('Motivo').fill('Limpieza de una prueba anterior')
        await admin
          .getByRole('dialog')
          .getByRole('button', { name: 'Rechazar' })
          .click()
      }
      await admin.waitForTimeout(1000)
      await settle(admin, '/admin/publicidad')
    }
  }
}

/** Starts from an empty badge, whatever earlier runs left unread. */
async function markAllRead(page: Page): Promise<void> {
  await page.getByTestId('notification-bell').click()
  const markAll = page.getByRole('menuitem', {
    name: 'Marcar todas como leídas',
  })
  if (await markAll.isVisible()) await markAll.click()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('notification-badge')).toHaveCount(0)
}

test('a sponsored-spot request rings the admin live, and the approval updates the restaurant’s screen without a reload', async ({
  browser,
}) => {
  test.setTimeout(240_000)
  const admin = await open(browser, 'admin')
  await clearLeftovers(admin)
  await markAllRead(admin)
  await expect(
    admin.getByRole('button', { name: `Aprobar la campaña de ${STORE}` }),
  ).toHaveCount(0)

  const owner = await open(browser, 'merchant')
  await settle(owner, '/dashboard/publicidad')
  await markAllRead(owner)

  // 1. The restaurant asks for a spot on the home.
  await owner
    .getByRole('radio', { name: /Destacados de la página principal/ })
    .check({ force: true })
  await owner.getByRole('button', { name: 'Solicitar campaña' }).click()
  await expect(owner.getByText(/Solicitud enviada/).first()).toBeVisible()

  // 2. The admin's open screen rings: a toast, the badge, and the request in
  //    the list, all without reloading.
  await expect(
    admin.getByText('Nueva solicitud de publicidad').first(),
  ).toBeVisible(LIVE)
  await expect(admin.getByTestId('notification-badge')).toHaveText('1', LIVE)
  await expect(
    admin.getByRole('button', { name: `Aprobar la campaña de ${STORE}` }),
  ).toBeVisible(LIVE)

  // 3. The bell lists it, accessibly; opening it marks it read.
  await admin.getByTestId('notification-bell').click()
  const item = admin.getByRole('menuitem', {
    name: /Nueva solicitud de publicidad \(sin leer\)/,
  })
  await expect(item).toContainText(STORE)
  await expect(item).toContainText('Requiere acción')
  // Scoped to the open menu: while it is open Radix hides the rest of the
  // page from assistive tech (and traps focus), as with a dialog.
  await expectNoA11yViolations(admin, 'notification bell menu', {
    include: '[role="menu"]',
  })
  await item.click()
  await expect(admin.getByTestId('notification-badge')).toHaveCount(0)

  // 4. The admin approves; the restaurant's card turns "Al aire" by itself.
  await admin
    .getByRole('button', { name: `Aprobar la campaña de ${STORE}` })
    .click()
  await expect(
    admin.getByText(`Campaña de ${STORE} aprobada.`).first(),
  ).toBeVisible()

  await expect(owner.getByText('Tu campaña fue aprobada').first()).toBeVisible(
    LIVE,
  )
  await expect(owner.getByTestId('notification-badge')).toHaveText('1', LIVE)
  await expect(owner.getByText('Al aire', { exact: true })).toBeVisible(LIVE)

  // Cleanup.
  await clearLeftovers(admin)
})
