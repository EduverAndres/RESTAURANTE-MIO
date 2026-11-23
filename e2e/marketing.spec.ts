import { expectNoA11yViolations } from './axe'
import { expect, test } from './fixtures'

// The audience landings: each one has to send its reader to the right
// sign-up, never claim an income or a figure it cannot back, and pass the
// same audit as the rest of the app.

test('the courier landing estimates honestly and signs up as a courier', async ({
  page,
}) => {
  await page.goto('/repartidores')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Gana dinero entregando',
  )

  // The estimate carries its disclaimer, visibly, next to the figure.
  await expect(
    page.getByText('Es una estimación, no una garantía de ingresos.'),
  ).toBeVisible()

  for (const link of await page
    .getByRole('link', { name: /Quiero repartir/ })
    .all()) {
    await expect(link).toHaveAttribute('href', '/register?role=courier')
  }

  await expectNoA11yViolations(page, 'courier landing')
})

test('the owner landing keeps the merchant role and shows a live store', async ({
  page,
}) => {
  await page.goto('/para-restaurantes')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  const signUps = await page
    .getByRole('link', { name: /Crear mi tienda/ })
    .all()
  expect(signUps.length).toBeGreaterThan(0)
  for (const link of signUps) {
    await expect(link).toHaveAttribute('href', '/register?role=merchant')
  }

  await expectNoA11yViolations(page, 'owner landing')

  // The demo link is read from the database, so it opens a real storefront.
  const demo = page.getByRole('link', { name: 'Ver una tienda de verdad' })
  await expect(demo.first()).toHaveAttribute('href', /^\/t\/[^/]+$/)
  await demo.first().click()
  await page.waitForURL(/\/t\/[^/]+$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('the home switches audience and every panel has its own way in', async ({
  page,
}) => {
  await page.goto('/')
  const switcher = page.getByRole('region', {
    name: 'Una app para pedir, vender y entregar',
  })
  await switcher.getByRole('tab', { name: 'Domiciliarios' }).click()
  await expect(
    switcher.getByRole('tabpanel').getByRole('link', {
      name: 'Quiero repartir',
    }),
  ).toHaveAttribute('href', '/repartidores')

  await switcher.getByRole('tab', { name: 'Restaurantes' }).click()
  await expect(
    switcher.getByRole('tabpanel').getByRole('link', { name: /^Vender con/ }),
  ).toHaveAttribute('href', '/para-restaurantes')

  await expectNoA11yViolations(page, 'marketplace home · audience switcher')
})
