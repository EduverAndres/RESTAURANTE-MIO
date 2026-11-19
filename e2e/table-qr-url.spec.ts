import { expect, test } from '@playwright/test'

// Table QR codes must print the official site URL (NEXT_PUBLIC_SITE_URL) and
// open, for anyone, the table's public page: same slug, same token, no
// sign-in. Run it against a production build (`next build` + the standalone
// server): in development the QR deliberately swaps localhost for the LAN
// address so a phone can open it.
//
//   E2E_SITE_URL=http://localhost:3000 npx playwright test e2e/table-qr-url.spec.ts

const SITE = process.env.E2E_SITE_URL
test.skip(!SITE, 'Requires E2E_SITE_URL and a production build.')

const MERCHANT = { email: 'owner1@tienda.app', password: 'Tienda123!' }
// Hosts a deployment must never send people to again.
const STALE_HOSTS = ['3.81.127.39']

test('los QR de las mesas usan el dominio oficial y abren sin sesión', async ({
  page,
  browser,
}) => {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(MERCHANT.email)
  await page.getByLabel('Contraseña', { exact: true }).fill(MERCHANT.password)
  await page.locator('#login-accept').check()
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))

  await page.goto('/dashboard/tables')
  const firstTable = page.getByRole('article', { name: /^Mesa \d+/ }).first()
  const href = await firstTable
    .locator('a[href*="/mesa/"]')
    .first()
    .getAttribute('href')
  expect(href).toBeTruthy()
  const url = new URL(href!)
  expect(url.origin).toBe(new URL(SITE!).origin)
  expect(url.pathname).toMatch(/^\/t\/[a-z0-9-]+\/mesa\/[A-Za-z0-9_-]+$/)

  // A customer's phone: no session, no cookies.
  const guest = await (await browser.newContext()).newPage()
  const response = await guest.goto(href!)
  expect(response?.status()).toBe(200)
  await expect(guest).toHaveURL(href!)
  await expect(guest).toHaveTitle(/Mesa \d+/)
  const html = await guest.content()
  for (const stale of STALE_HOSTS) expect(html).not.toContain(stale)
  await guest.context().close()
})
