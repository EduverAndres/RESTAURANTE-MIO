import { expectNoA11yViolations } from './axe'
import { expect, test } from './fixtures'

test.use({ role: 'merchant' })

test('the merchant sees the order board and can advance a pending order', async ({
  page,
}) => {
  await page.goto('/dashboard')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Pedidos' }),
  ).toBeVisible()

  const pendingHeading = page.getByRole('heading', { level: 2, name: 'Nuevos' })
  await expect(pendingHeading).toBeVisible()
  const acceptedHeading = page.getByRole('heading', {
    level: 2,
    name: 'Aceptados',
  })
  await expect(acceptedHeading).toBeVisible()

  await expectNoA11yViolations(page, 'merchant dashboard · order board')

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

  // Named rather than positional: since Phase 5 the first button on a card is
  // the actions menu, and the transitions follow it.
  await card.getByRole('button', { name: 'Aceptar' }).click()

  await expect(
    pendingColumn.getByRole('article', { name: cardLabel ?? undefined }),
  ).toHaveCount(0)
  await expect(acceptedColumn.getByRole('article')).toHaveCount(
    acceptedCountBefore + 1,
  )
})

test('the board is operable from the keyboard alone', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Pedidos' }),
  ).toBeVisible()

  const pendingHeading = page.getByRole('heading', { level: 2, name: 'Nuevos' })
  const pendingColumn = page.locator('section', { has: pendingHeading })
  const pendingCards = pendingColumn.getByRole('article')

  test.skip(
    (await pendingCards.count()) === 0,
    'No pending order for the seeded merchant store at test time.',
  )

  const card = pendingCards.first()
  const cardLabel = await card.getAttribute('aria-label')

  // Every card is a tab stop, and advertises the keys it responds to.
  await card.focus()
  await expect(card).toBeFocused()
  await expect(card).toHaveAttribute('aria-keyshortcuts', /A/)

  // The actions menu lists the legal transitions and nothing else.
  await card.getByRole('button', { name: /^Acciones del pedido/ }).click()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: /Aceptar/ })).toBeVisible()
  await expect(
    menu.getByRole('menuitem', { name: /Marcar listo/ }),
  ).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()

  // "A" on the focused card accepts it, and the board announces the move once.
  await card.focus()
  await page.keyboard.press('a')

  const acceptedHeading = page.getByRole('heading', {
    level: 2,
    name: 'Aceptados',
  })
  const acceptedColumn = page.locator('section', { has: acceptedHeading })
  await expect(
    acceptedColumn.getByRole('article', { name: cardLabel ?? undefined }),
  ).toHaveCount(1)
  await expect(
    page.getByRole('status').filter({ hasText: /movido a/ }),
  ).toContainText('Aceptados')
})
