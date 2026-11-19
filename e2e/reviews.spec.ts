import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { expect, loginAs, test } from './fixtures'

// Store reviews end to end: a delivered order can be reviewed once, the
// review shows on the storefront (to anyone), the store's average and count
// move, and the database refuses what the UI never offers.
//
// It needs to create a delivered order, so it runs against the local stack:
//
//   E2E_SUPABASE_DB_CONTAINER=supabase_db_RESTAURANTE-MIO \
//   E2E_SUPABASE_URL=http://127.0.0.1:54321 \
//   E2E_SUPABASE_PUBLISHABLE_KEY=<local publishable key> \
//   npx playwright test e2e/reviews.spec.ts

const DB = process.env.E2E_SUPABASE_DB_CONTAINER
const API_URL = process.env.E2E_SUPABASE_URL
const API_KEY = process.env.E2E_SUPABASE_PUBLISHABLE_KEY

test.skip(!DB, 'Requires E2E_SUPABASE_DB_CONTAINER (local Supabase).')
test.describe.configure({ mode: 'serial' })

const STORE_SLUG = 'la-parrilla-del-norte'
const CUSTOMER = 'cliente1@tienda.app'
const OWNER = 'owner1@tienda.app'
const PASSWORD = 'Tienda123!'
const COMMENT = `Picada en su punto, llegó caliente (${Date.now().toString(36)})`

function sql(query: string): string {
  return execFileSync('docker', [
    'exec',
    DB!,
    'psql',
    '-U',
    'postgres',
    '-tA',
    '-c',
    query,
  ])
    .toString()
    .trim()
}

/** A fresh order for the seeded customer, in the given status. */
function createOrder(status: 'delivered' | 'preparing'): string {
  return sql(`
    with s as (select id from stores where slug = '${STORE_SLUG}'),
         c as (select id from auth.users where email = '${CUSTOMER}'),
         o as (
           insert into orders (store_id, customer_id, type, status, subtotal, total, payment_method)
           select s.id, c.id, 'pickup', '${status}', 42000, 42000, 'cash' from s, c
           returning id
         ),
         i as (
           insert into order_items (order_id, name_snapshot, unit_price, quantity)
           select id, 'Picada familiar', 42000, 1 from o
         )
    select id from o;
  `)
    .split('\n')
    .filter((line) => /^[0-9a-f-]{36}$/.test(line))[0]!
}

function storeRating(): { avg: number; count: number } {
  const [avg, count] = sql(
    `select rating_avg, rating_count from stores where slug = '${STORE_SLUG}'`,
  ).split('|')
  return { avg: Number(avg), count: Number(count) }
}

let orderId = ''
let before = { avg: 0, count: 0 }

test.beforeAll(() => {
  orderId = createOrder('delivered')
  before = storeRating()
})

test('un pedido entregado se reseña una vez y la reseña llega a la tienda', async ({
  page,
  browser,
}) => {
  await loginAs(page, 'customer')
  await page.goto(`/orders/${orderId}`)

  await page.getByRole('radio', { name: /^5 estrellas/ }).click()
  await page.getByLabel(/comentario/i).fill(COMMENT)
  await page.getByRole('button', { name: 'Enviar valoración' }).click()
  await expect(page.getByText('Gracias por valorar este pedido.')).toBeVisible()

  // Once is all: after a reload there is no form to send again.
  await page.reload()
  await expect(page.getByText('Gracias por valorar este pedido.')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Enviar valoración' }),
  ).toHaveCount(0)

  // The aggregate moved, computed by the database from the reviews.
  const after = storeRating()
  expect(after.count).toBe(before.count + 1)
  expect(after.avg).toBeGreaterThan(0)

  // Anyone, signed in or not, sees it on the storefront.
  const visitor = await (await browser.newContext()).newPage()
  await visitor.goto(`/t/${STORE_SLUG}`)
  const section = visitor.locator('#opiniones')
  await expect(section).toBeVisible()
  await expect(section.getByText(COMMENT)).toBeVisible()
  await visitor.context().close()
})

test('la base de datos rechaza lo que la interfaz no ofrece', async () => {
  test.skip(!API_URL || !API_KEY, 'Requires E2E_SUPABASE_URL and key.')
  const customer = createClient(API_URL!, API_KEY!, {
    auth: { persistSession: false },
  })
  const { data: session } = await customer.auth.signInWithPassword({
    email: CUSTOMER,
    password: PASSWORD,
  })
  const customerId = session.user!.id
  const storeId = sql(`select id from stores where slug = '${STORE_SLUG}'`)

  // A second review of the same order.
  const again = await customer.from('reviews').insert({
    order_id: orderId,
    store_id: storeId,
    customer_id: customerId,
    rating: 1,
  })
  expect(again.error?.code).toBe('23505')

  // An order that has not been delivered yet.
  const pending = createOrder('preparing')
  const early = await customer.from('reviews').insert({
    order_id: pending,
    store_id: storeId,
    customer_id: customerId,
    rating: 5,
  })
  expect(early.error?.code).toBe('42501')

  // Someone else's delivered order.
  const owner = createClient(API_URL!, API_KEY!, {
    auth: { persistSession: false },
  })
  const { data: ownerSession } = await owner.auth.signInWithPassword({
    email: OWNER,
    password: PASSWORD,
  })
  const foreign = createOrder('delivered')
  const notMine = await owner.from('reviews').insert({
    order_id: foreign,
    store_id: storeId,
    customer_id: ownerSession.user!.id,
    rating: 5,
  })
  expect(notMine.error?.code).toBe('42501')

  // The owner cannot write its own average.
  const inflate = await owner
    .from('stores')
    .update({ rating_avg: 5, rating_count: 9999 })
    .eq('id', storeId)
  expect(inflate.error?.code).toBe('42501')

  // Nobody edits a review after the fact.
  const edit = await customer
    .from('reviews')
    .update({ rating: 1 })
    .eq('order_id', orderId)
    .select('id')
  expect(edit.error ?? edit.data).toEqual([])
})
