import { execFileSync } from 'node:child_process'
import { expect, test, type Browser, type Page } from '@playwright/test'

// The whole account life cycle, end to end, against a real Supabase Auth and
// a real mailbox: sign up → confirm → sign in → browse → sign out → recover
// → new password → sign in again.
//
// It needs a Supabase whose emails land somewhere readable, i.e. the local
// stack (`npx supabase start`), which ships Mailpit. Point the app at it and
// run:
//
//   E2E_MAILPIT_URL=http://127.0.0.1:54324 \
//   E2E_SUPABASE_DB_CONTAINER=supabase_db_RESTAURANTE-MIO \
//   npx playwright test e2e/auth.spec.ts
//
// E2E_SUPABASE_DB_CONTAINER is optional: with it, the expired-link case ages
// a real recovery token in the database instead of waiting for it to expire,
// and each run starts with fresh auth rate-limit counters.

const MAILPIT = process.env.E2E_MAILPIT_URL
const DB_CONTAINER = process.env.E2E_SUPABASE_DB_CONTAINER

test.skip(!MAILPIT, 'Requires E2E_MAILPIT_URL (local Supabase with Mailpit).')
test.describe.configure({ mode: 'serial' })

const RUN = Date.now().toString(36)
const EMAIL = `e2e-auth-${RUN}@example.com`
const OLD_PASSWORD = `Antigua-${RUN}-1`
const NEW_PASSWORD = `Nueva-${RUN}-2`

interface MailpitSummary {
  ID: string
  Subject: string
  Created: string
}

/** Origin every public link must use: the app's NEXT_PUBLIC_SITE_URL. */
const SITE = new URL(
  process.env.E2E_SITE_URL ??
    process.env.PLAYWRIGHT_BASE_URL ??
    'http://localhost:3000',
).origin

/** Waits for a new email to `to` whose subject matches, returns its link. */
async function awaitEmailLink(
  to: string,
  subject: RegExp,
  seen: ReadonlySet<string> = new Set(),
): Promise<{ id: string; link: string }> {
  const query = encodeURIComponent(`to:"${to}"`)
  for (let attempt = 0; attempt < 40; attempt++) {
    const response = await fetch(`${MAILPIT}/api/v1/search?query=${query}`)
    const { messages } = (await response.json()) as {
      messages: MailpitSummary[]
    }
    const match = messages.find(
      (message) => subject.test(message.Subject) && !seen.has(message.ID),
    )
    if (match) {
      const detail = (await (
        await fetch(`${MAILPIT}/api/v1/message/${match.ID}`)
      ).json()) as { HTML: string }
      const href = /href="([^"]*\/auth\/callback\?[^"]*)"/.exec(detail.HTML)
      if (!href) throw new Error('Email without an auth link')
      const link = href[1].replaceAll('&amp;', '&')
      // Every link in the email points at the official site.
      for (const any of detail.HTML.matchAll(/href="(https?:[^"]+)"/g)) {
        expect(new URL(any[1].replaceAll('&amp;', '&')).origin).toBe(SITE)
      }
      return { id: match.ID, link }
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`No email matching ${subject} reached ${to}`)
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.locator('#login-accept').check()
  await page.getByRole('button', { name: 'Entrar' }).click()
}

async function freshPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext()
  return context.newPage()
}

// Every run signs in, signs up and asks for emails from the same address, so
// back-to-back runs would exhaust the per-address auth budgets (that is the
// limiter doing its job). Start each run with fresh counters when possible.
test.beforeAll(() => {
  if (!DB_CONTAINER) return
  execFileSync('docker', [
    'exec',
    DB_CONTAINER,
    'psql',
    '-U',
    'postgres',
    '-c',
    "delete from public.rate_limits where bucket like 'auth\\_%'",
  ])
})

const seenRecoveryEmails = new Set<string>()
let usedRecoveryLink = ''

test('1. registra un usuario nuevo y confirma el correo', async ({ page }) => {
  await page.goto('/register')
  await page.getByLabel('Nombre completo').fill('Prueba Autenticación')
  await page.getByLabel('Correo electrónico').fill(EMAIL)
  await page.getByLabel('Contraseña', { exact: true }).fill(OLD_PASSWORD)

  // The confirmation is checked before anything reaches the server.
  await page.getByLabel('Confirmar contraseña').fill(`${OLD_PASSWORD}x`)
  await page.locator('#register-accept').check()
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page.getByText('Las contraseñas no coinciden.')).toBeVisible()

  await page.getByLabel('Confirmar contraseña').fill(OLD_PASSWORD)
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(
    page.getByRole('heading', { name: 'Revisa tu correo' }),
  ).toBeVisible()

  // Unconfirmed accounts cannot sign in yet.
  const other = await freshPage(page.context().browser()!)
  await login(other, EMAIL, OLD_PASSWORD)
  await expect(
    other.getByText('Confirma tu correo electrónico antes de iniciar sesión.'),
  ).toBeVisible()
  await other.context().close()

  const { link } = await awaitEmailLink(EMAIL, /Confirma tu cuenta/)
  await page.goto(link)
  await page.waitForURL((url) => url.pathname === '/')
  await page.goto('/account')
  await expect(page.getByText(EMAIL)).toBeVisible()
})

test('2. no permite registrar dos veces el mismo correo', async ({
  browser,
}) => {
  const page = await freshPage(browser)
  await page.goto('/register')
  await page.getByLabel('Nombre completo').fill('Otra Persona')
  await page.getByLabel('Correo electrónico').fill(EMAIL)
  await page.getByLabel('Contraseña', { exact: true }).fill('OtraClave-123')
  await page.getByLabel('Confirmar contraseña').fill('OtraClave-123')
  await page.locator('#register-accept').check()
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(
    page.getByText('Ya existe una cuenta con este correo electrónico.'),
  ).toBeVisible()
  await page.context().close()
})

test('3-7. login, sesión persistente, ruta privada y cierre de sesión', async ({
  browser,
}) => {
  const page = await freshPage(browser)

  // 4. Wrong password: generic message, no session.
  await login(page, EMAIL, 'NoEsLaClave-1')
  await expect(page.getByText('Correo o contraseña incorrectos.')).toBeVisible()
  await expect(page).toHaveURL(/\/login/)

  // 3. Right password: redirected to the role home (customer → /).
  await login(page, EMAIL, OLD_PASSWORD)
  await page.waitForURL((url) => url.pathname === '/')

  // 5. The session survives a reload.
  await page.goto('/account')
  await page.reload()
  await expect(page).toHaveURL(/\/account$/)
  await expect(page.getByText(EMAIL)).toBeVisible()

  // An authenticated visitor is sent away from the login page.
  await page.goto('/login')
  await page.waitForURL((url) => url.pathname === '/')

  const sessionCookies = await page.context().cookies()

  // 7. Sign out clears the session…
  await page.goto('/account')
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await page.waitForURL((url) => url.pathname === '/')
  // …lands on the site's own home page, never on another host…
  expect(new URL(page.url()).origin).toBe(SITE)
  // …and the Back button does not bring the private page back.
  await page.goBack()
  await expect(page).toHaveURL(/\/login\?next=%2Faccount/)
  expect(
    (await page.context().cookies()).filter((c) => c.name.includes('auth')),
  ).toHaveLength(0)
  await page.goto('/account')
  await expect(page).toHaveURL(/\/login\?next=%2Faccount/)

  // …and invalidates it server-side: replaying the old cookies is useless.
  const replay = await browser.newContext()
  await replay.addCookies(sessionCookies)
  const replayPage = await replay.newPage()
  await replayPage.goto('/account')
  await expect(replayPage).toHaveURL(/\/login\?next=%2Faccount/)
  await replay.close()
  await page.context().close()

  // 6. Anonymous visitors never reach private routes.
  const anonymous = await freshPage(browser)
  for (const path of ['/account', '/orders', '/account/reset-password']) {
    await anonymous.goto(path)
    await expect(anonymous).toHaveURL(/\/login\?next=/)
  }
  await anonymous.context().close()
})

test('8-9, 11-12. recupera la contraseña y entra solo con la nueva', async ({
  browser,
}) => {
  // A session opened elsewhere with the old password, e.g. by whoever learnt
  // it. Recovering the password must end it (Supabase Auth revokes the other
  // sessions; this guards against a configuration or version that would not).
  const elsewhere = await freshPage(browser)
  await login(elsewhere, EMAIL, OLD_PASSWORD)
  await elsewhere.waitForURL((url) => url.pathname === '/')

  const page = await freshPage(browser)

  // An unknown address gets the same answer: no account enumeration.
  await page.goto('/forgot-password')
  await page.getByLabel('Correo electrónico').fill(`nadie-${RUN}@example.com`)
  await page.getByRole('button', { name: 'Enviar enlace' }).click()
  await expect(
    page.getByRole('heading', { name: 'Revisa tu correo' }),
  ).toBeVisible()

  // 8. Real request for the real account.
  await page.goto('/forgot-password')
  await page.getByLabel('Correo electrónico').fill(EMAIL)
  await page.getByRole('button', { name: 'Enviar enlace' }).click()
  await expect(
    page.getByRole('heading', { name: 'Revisa tu correo' }),
  ).toBeVisible()

  // 9. The link from the mailbox opens the new-password form.
  const { id, link } = await awaitEmailLink(EMAIL, /contraseña/i)
  seenRecoveryEmails.add(id)
  usedRecoveryLink = link
  await page.goto(link)
  await page.waitForURL(/\/account\/reset-password$/)

  await page.getByLabel('Nueva contraseña').fill(NEW_PASSWORD)
  await page.getByLabel('Confirmar contraseña').fill(`${NEW_PASSWORD}x`)
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()
  await expect(page.getByText('Las contraseñas no coinciden.')).toBeVisible()

  await page.getByLabel('Confirmar contraseña').fill(NEW_PASSWORD)
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()
  await expect(page.getByText('Contraseña actualizada.')).toBeVisible()
  await page.waitForURL(/\/account$/)
  await page.context().close()

  // The other session was revoked; the one that changed the password was not.
  await elsewhere.goto('/account')
  await expect(elsewhere).toHaveURL(/\/login\?next=%2Faccount/)
  await elsewhere.context().close()

  // 12. The old password no longer works.
  const oldAttempt = await freshPage(browser)
  await login(oldAttempt, EMAIL, OLD_PASSWORD)
  await expect(
    oldAttempt.getByText('Correo o contraseña incorrectos.'),
  ).toBeVisible()
  await oldAttempt.context().close()

  // 11. The new one does.
  const newAttempt = await freshPage(browser)
  await login(newAttempt, EMAIL, NEW_PASSWORD)
  await newAttempt.waitForURL((url) => url.pathname === '/')
  await newAttempt.goto('/account')
  await expect(newAttempt.getByText(EMAIL)).toBeVisible()
  await newAttempt.context().close()
})

test('10. rechaza enlaces de recuperación usados o expirados', async ({
  browser,
}) => {
  // Already used.
  const reused = await freshPage(browser)
  await reused.goto(usedRecoveryLink)
  await expect(reused).toHaveURL(/\/login\?error=/)
  await expect(
    reused.getByText(/El enlace expiró o ya fue usado|No pudimos validar/),
  ).toBeVisible()
  await reused.goto('/account')
  await expect(reused).toHaveURL(/\/login\?next=/)
  await reused.context().close()

  test.skip(!DB_CONTAINER, 'Expired case needs E2E_SUPABASE_DB_CONTAINER.')

  // Expired: a fresh link, aged past the OTP lifetime in the database.
  const page = await freshPage(browser)
  await page.goto('/forgot-password')
  await page.getByLabel('Correo electrónico').fill(EMAIL)
  await page.getByRole('button', { name: 'Enviar enlace' }).click()
  await expect(
    page.getByRole('heading', { name: 'Revisa tu correo' }),
  ).toBeVisible()
  const { link } = await awaitEmailLink(
    EMAIL,
    /contraseña/i,
    seenRecoveryEmails,
  )

  execFileSync('docker', [
    'exec',
    DB_CONTAINER!,
    'psql',
    '-U',
    'postgres',
    '-c',
    `update auth.users set recovery_sent_at = now() - interval '30 days' where email = '${EMAIL}'`,
  ])

  await page.goto(link)
  await expect(page).toHaveURL(/\/login\?error=expired/)
  await expect(page.getByText('El enlace expiró o ya fue usado')).toBeVisible()
  await page.context().close()

  // And the password from the previous test is still the one in force.
  const check = await freshPage(browser)
  await login(check, EMAIL, NEW_PASSWORD)
  await check.waitForURL((url) => url.pathname === '/')
  await check.context().close()
})

test('frena la fuerza bruta contra una cuenta', async ({ browser }) => {
  const page = await freshPage(browser)
  const target = `fuerza-bruta-${RUN}@example.com`
  await page.goto('/login')
  await page.locator('#login-accept').check()
  await page.getByLabel('Correo electrónico').fill(target)
  for (let attempt = 1; attempt <= 10; attempt++) {
    await page
      .getByLabel('Contraseña', { exact: true })
      .fill(`Intento-${attempt}`)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(
      page.getByText('Correo o contraseña incorrectos.').last(),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled()
  }
  await page.getByLabel('Contraseña', { exact: true }).fill('Intento-11')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText(/Demasiados intentos/)).toBeVisible()
  await page.context().close()
})
