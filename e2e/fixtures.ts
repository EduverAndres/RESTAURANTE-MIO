import { test as base, expect, type Page } from '@playwright/test'

// Shared login helper and seeded accounts for the e2e suite. See
// supabase/seed.sql for the source of truth; password is fixed for every
// seeded user.
export const PASSWORD = 'Tienda123!'

export const SEED_USERS = {
  customer: 'cliente1@tienda.app',
  merchant: 'owner1@tienda.app',
  admin: 'admin@tienda.app',
  courier: 'courier1@tienda.app',
} as const

export type SeedRole = keyof typeof SEED_USERS

/** Logs a seeded user in through the real login form and waits for the redirect. */
export async function loginAs(page: Page, role: SeedRole): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(SEED_USERS[role])
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

interface Fixtures {
  /** Seeded role to log in as before the test runs; `null` skips login. */
  role: SeedRole | null
}

/**
 * Extends the base test with a `role` option: `test.use({ role: 'merchant' })`
 * logs the fixture `page` in before the test body runs. Tests that need an
 * anonymous or explicitly-timed login keep using `loginAs` directly.
 */
export const test = base.extend<Fixtures>({
  role: [null, { option: true }],
  page: async ({ page, role }, use) => {
    if (role) await loginAs(page, role)
    await use(page)
  },
})

export { expect }
