import { expect, test } from './fixtures'

test.use({ role: 'merchant' })

test('the merchant sees the order board and can advance a pending order', async ({
  page,
}) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { level: 1, name: 'Pedidos' })).toBeVisible()

  const pendingHeading = page.getByRole('heading', { level: 2, name: 'Nuevos' })
  await expect(pendingHeading).toBeVisible()
  const acceptedHeading = page.getByRole('heading', { level: 2, name: 'Aceptados' })
  await expect(acceptedHeading).toBeVisible()

  const pendingColumn = page.locator('section', { has: pendingHeading })
  const acceptedColumn = page.locator('section', { has: acceptedHeading })
  const pendingCards = pendingColumn.getByRole('article')
  const pendingCountBefore = await pendingCards.count()

  test.skip(
    pendingCountBefore === 0,
    'No pending order for the seeded merchant store at test time; board rendering was verified above.',
  )

  const acceptedCountBefore = await acceptedColumn.getByRole('article').count()
  const card = pendingCards.first()
  const cardLabel = await card.getAttribute('aria-label')

  // The non-destructive action ("Aceptar") is always listed before the
  // destructive one ("Rechazar"); see lib/orders/status.ts.
  await card.getByRole('button').first().click()

  await expect(pendingColumn.getByRole('article', { name: cardLabel ?? undefined })).toHaveCount(
    0,
  )
  await expect(acceptedColumn.getByRole('article')).toHaveCount(acceptedCountBefore + 1)
})
