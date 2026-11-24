import { expect, loginAs, test } from './fixtures'

// Signing out ends this browser's session only. It used to end every session
// of the account (supabase-js signs out globally by default): a customer
// signed in on a phone and a laptop, or testing from two browsers, was thrown
// to the login page in the other one at its next server request, typically
// the live refresh when a store answered their reservation.

test('signing out on one browser leaves the other signed in', async ({
  browser,
}) => {
  const laptop = await (await browser.newContext()).newPage()
  const phone = await (await browser.newContext()).newPage()
  await loginAs(laptop, 'customer')
  await loginAs(phone, 'customer')
  await phone.goto('/account')
  const phoneCookies = await phone.context().cookies()

  await phone.getByRole('button', { name: 'Cerrar sesión' }).click()
  await phone.waitForURL((url) => url.pathname === '/')

  // The laptop keeps its session, even through a server round trip.
  await laptop.goto('/account')
  await expect(laptop).toHaveURL(/\/account$/)
  await laptop.reload()
  await expect(laptop).toHaveURL(/\/account$/)

  // The session that signed out is revoked server-side, not only forgotten
  // by its browser: replaying its old cookies gets nowhere.
  const replay = await (await browser.newContext()).newPage()
  await replay.context().addCookies(phoneCookies)
  await replay.goto('/account')
  await expect(replay).toHaveURL(/\/login\?next=%2Faccount/)

  for (const page of [laptop, phone, replay]) await page.context().close()
})
