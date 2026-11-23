import type { Browser, Page } from '@playwright/test'
import { expectNoA11yViolations } from './axe'
import { expect, loginAs, test, type SeedRole } from './fixtures'

// Sponsored placements, end to end: the restaurant asks for a spot on the
// home's "Destacados", an admin approves it, a visitor sees it labelled
// "Patrocinado" and the click lands on the store. The admin ends it at the
// end (and clears leftovers at the start), so the run is repeatable: a store
// holds one campaign per placement and dates. Relies on the seed's
// la-parrilla-del-norte, owned by owner1@tienda.app.

const STORE = 'La Parrilla del Norte'
const SLUG = 'la-parrilla-del-norte'
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

test.describe.configure({ mode: 'serial' })

/** Answered like a visitor would ("Solo esenciales"), before any page loads. */
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

async function open(browser: Browser, role: SeedRole | null): Promise<Page> {
  const context = await browser.newContext()
  await context.addCookies([CONSENT])
  const page = await context.newPage()
  if (role) await loginAs(page, role)
  return page
}

/** The store never reaches `networkidle`; give React time to hydrate. */
async function settle(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'load' })
  await page.waitForTimeout(3000)
}

/** Ends or rejects whatever a previous, interrupted run left behind. */
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
        await expect(
          admin.getByText('Campaña terminada.').first(),
        ).toBeVisible()
      } else {
        await admin.getByLabel('Motivo').fill('Limpieza de una prueba anterior')
        await admin
          .getByRole('dialog')
          .getByRole('button', { name: 'Rechazar' })
          .click()
        await expect(
          admin.getByText(`Campaña de ${STORE} rechazada.`).first(),
        ).toBeVisible()
      }
      await settle(admin, '/admin/publicidad')
    }
  }
}

test('a restaurant buys a featured spot, an admin approves it and the click reaches the store', async ({
  browser,
}) => {
  // Three signed-in sessions and a dev server compiling each page on first
  // visit: well past the default 90 s.
  test.setTimeout(240_000)
  const admin = await open(browser, 'admin')
  await clearLeftovers(admin)

  // 1. The restaurant asks for three days on the home, starting today.
  const owner = await open(browser, 'merchant')
  await settle(owner, '/dashboard/publicidad')
  await expect(
    owner.getByRole('heading', { level: 1, name: 'Publicidad' }),
  ).toBeVisible()
  await owner
    .getByRole('radio', { name: /Destacados de la página principal/ })
    .check({ force: true })
  await expect(owner.getByText(/3 días × \$\s?15\.000/)).toBeVisible()
  await expect(owner.getByText(/Quedan? \d+ cupos?/)).toBeVisible()
  await expectNoA11yViolations(owner, 'merchant ads')
  await owner.getByRole('button', { name: 'Solicitar campaña' }).click()
  await expect(owner.getByText(/Solicitud enviada/).first()).toBeVisible()
  await expect(owner.getByText('Por aprobar').first()).toBeVisible()

  // 2. An admin approves it.
  await settle(admin, '/admin/publicidad')
  await expect(
    admin.getByRole('heading', { level: 1, name: 'Publicidad' }),
  ).toBeVisible()
  await expectNoA11yViolations(admin, 'admin ads')
  await admin
    .getByRole('button', { name: `Aprobar la campaña de ${STORE}` })
    .click()
  await expect(
    admin.getByText(`Campaña de ${STORE} aprobada.`).first(),
  ).toBeVisible()
  await settle(admin, '/admin/publicidad')
  await expect(
    admin
      .getByRole('region', { name: 'Al aire y programadas' })
      .getByRole('row', { name: new RegExp(STORE) })
      .getByText('Al aire', { exact: true }),
  ).toBeVisible()

  // 3. A visitor sees it first in "Destacados", visibly labelled.
  const visitor = await open(browser, null)
  await settle(visitor, '/')
  const featured = visitor.getByRole('region', { name: 'Destacados' })
  await expect(
    featured.getByText('Patrocinados y negocios con plan VIP'),
  ).toBeVisible()
  const card = featured.getByRole('link', {
    name: `Ver ${STORE} (patrocinado)`,
  })
  await expect(card).toHaveAttribute('rel', 'sponsored')
  await expect(card.getByText('Patrocinado')).toBeVisible()

  // 4. The click goes through the counter and lands on the store.
  await card.click()
  await visitor.waitForURL(new RegExp(`/t/${SLUG}$`))
  await expect(visitor.getByRole('heading', { level: 1 })).toHaveText(STORE)

  // 5. The restaurant sees it on the air; the admin ends it (cleanup).
  await settle(owner, '/dashboard/publicidad')
  await expect(owner.getByText('Al aire', { exact: true })).toBeVisible()
  await clearLeftovers(admin)
})
