import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { expect, loginAs, test } from './fixtures'

// Dish reviews end to end against the local stack: rating a dish from the
// order page, the 3-rating threshold on the card, first names only in the
// drawer, admin hide/show recomputing the average, and the database refusing
// everything the UI never offers.
//
//   E2E_SUPABASE_DB_CONTAINER=supabase_db_RESTAURANTE-MIO \
//   E2E_SUPABASE_URL=http://127.0.0.1:54321 \
//   E2E_SUPABASE_PUBLISHABLE_KEY=<local publishable key> \
//   npx playwright test e2e/dish-reviews.spec.ts

const DB = process.env.E2E_SUPABASE_DB_CONTAINER
const API_URL = process.env.E2E_SUPABASE_URL
const API_KEY = process.env.E2E_SUPABASE_PUBLISHABLE_KEY

test.skip(!DB, 'Requires E2E_SUPABASE_DB_CONTAINER (local Supabase).')
test.describe.configure({ mode: 'serial' })

const STORE_SLUG = 'la-parrilla-del-norte'
const CUSTOMER = 'cliente1@tienda.app'
const OWNER = 'owner1@tienda.app'
const PASSWORD = 'Tienda123!'
const RUN = Date.now().toString(36)
const COMMENT = `Jugoso y en su punto (${RUN})`

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

function lastLine(output: string): string {
  return output.split('\n').filter(Boolean).at(-1)!
}

let product = { id: '', name: '' }

/** A delivered order of the seeded customer with one line of `product`. */
function deliveredOrder(): { orderId: string; itemId: string } {
  const out = sql(`
    with s as (select id from stores where slug = '${STORE_SLUG}'),
         c as (select id from auth.users where email = '${CUSTOMER}'),
         o as (
           insert into orders (store_id, customer_id, type, status, subtotal, total, payment_method)
           select s.id, c.id, 'pickup', 'delivered', 30000, 30000, 'cash' from s, c
           returning id
         ),
         i as (
           insert into order_items (order_id, product_id, name_snapshot, unit_price, quantity)
           select o.id, '${product.id}', '${product.name.replace(/'/g, "''")}', 30000, 1 from o
           returning id, order_id
         )
    select order_id || '|' || id from i;
  `)
  const [orderId, itemId] = lastLine(out).split('|')
  return { orderId: orderId!, itemId: itemId! }
}

function productRating(): { avg: number; count: number } {
  const [avg, count] = sql(
    `select rating_avg, rating_count from products where id = '${product.id}'`,
  ).split('|')
  return { avg: Number(avg), count: Number(count) }
}

test.beforeAll(() => {
  // A dish nobody has rated yet, so the threshold starts from zero.
  const row = lastLine(
    sql(`
      select p.id || '|' || p.name from products p
      join stores s on s.id = p.store_id
      where s.slug = '${STORE_SLUG}' and p.is_available
        and not exists (select 1 from product_reviews r where r.product_id = p.id)
      order by p.position limit 1;
    `),
  )
  const [id, ...name] = row.split('|')
  product = { id: id!, name: name.join('|') }
  // Two earlier ratings, written by the database function the app uses.
  for (const rating of [5, 4]) {
    const { orderId, itemId } = deliveredOrder()
    // The customer's session, simulated: claims first (as postgres, which
    // can read auth.users), then the API role, as PostgREST would do it.
    sql(`
      select set_config('request.jwt.claims',
        json_build_object('sub', (select id from auth.users where email = '${CUSTOMER}'), 'role', 'authenticated')::text, true);
      set local role authenticated;
      select public.submit_order_reviews('${orderId}', 5, null,
        '[{"order_item_id": "${itemId}", "rating": ${rating}}]'::jsonb);
    `)
  }
})

test('dos calificaciones no muestran nada; la tercera, desde el pedido, sí', async ({
  page,
  browser,
}) => {
  expect(productRating()).toEqual({ avg: 4.5, count: 2 })

  const visitor = await (await browser.newContext()).newPage()
  await visitor.goto(`/t/${STORE_SLUG}`)
  const card = visitor
    .getByRole('button', { name: `Ver ${product.name}` })
    .first()
    .locator('xpath=ancestor::*[self::article or self::li][1]')
  await expect(card).toBeVisible()
  await expect(card.getByText(/★/)).toHaveCount(0)

  const { orderId } = deliveredOrder()
  await loginAs(page, 'customer')
  await page.goto(`/orders/${orderId}`)
  await page.getByRole('radio', { name: /^5 estrellas/ }).click()
  await page
    .getByRole('radio', { name: `${product.name}: 3 estrellas, Regular` })
    .click()
  await page
    .getByRole('button', { name: `Agregar comentario sobre ${product.name}` })
    .click()
  const box = page.getByLabel(`Comentario sobre ${product.name}`)
  // The client enforces the 300-character cap.
  await box.fill('x'.repeat(320))
  await expect(box).toHaveValue('x'.repeat(300))
  await box.fill(COMMENT)
  await page.getByRole('button', { name: 'Enviar valoración' }).click()
  await expect(page.getByText('Gracias por valorar este pedido.')).toBeVisible()

  expect(productRating()).toEqual({ avg: 4, count: 3 })

  await visitor.reload()
  await expect(
    card.getByText('4,0 de 5 estrellas, 3 calificaciones'),
  ).toBeAttached()

  // The detail loads the latest comments, with the first name only.
  await visitor
    .getByRole('button', { name: `Ver ${product.name}` })
    .first()
    .click()
  const drawer = visitor.getByRole('dialog')
  const reviews = drawer.getByRole('region', {
    name: /Lo que dicen de este plato/,
  })
  await expect(reviews.getByText(COMMENT)).toBeVisible()
  await expect(reviews.getByText('Laura', { exact: true })).toBeVisible()
  await expect(reviews.getByText(/Gómez/)).toHaveCount(0)
  await visitor.context().close()
})

test('el admin oculta y vuelve a mostrar; el promedio sigue', async ({
  page,
}) => {
  await loginAs(page, 'admin')
  await page.goto('/admin/reviews')
  const row = page.getByRole('row').filter({ hasText: COMMENT })
  await row.getByRole('button', { name: /^Ocultar reseña/ }).click()
  await expect(
    row.getByRole('button', { name: /^Mostrar reseña/ }),
  ).toBeVisible()
  expect(productRating()).toEqual({ avg: 4.5, count: 2 })

  await row.getByRole('button', { name: /^Mostrar reseña/ }).click()
  await expect(
    row.getByRole('button', { name: /^Ocultar reseña/ }),
  ).toBeVisible()
  expect(productRating()).toEqual({ avg: 4, count: 3 })
})

test('la base de datos rechaza lo que la interfaz no ofrece', async () => {
  test.skip(!API_URL || !API_KEY, 'Requires E2E_SUPABASE_URL and key.')
  const anon = createClient(API_URL!, API_KEY!, {
    auth: { persistSession: false },
  })
  // Public columns only: who wrote it is not readable.
  const leak = await anon.from('product_reviews').select('customer_id').limit(1)
  expect(leak.error?.code).toBe('42501')
  const ok = await anon
    .from('product_reviews')
    .select('author_first_name, rating, comment')
    .eq('product_id', product.id)
  expect(ok.error).toBeNull()
  for (const row of ok.data ?? []) {
    expect(row.author_first_name ?? '').not.toMatch(/\s/)
  }

  const customer = createClient(API_URL!, API_KEY!, {
    auth: { persistSession: false },
  })
  await customer.auth.signInWithPassword({
    email: CUSTOMER,
    password: PASSWORD,
  })
  const { orderId, itemId } = deliveredOrder()

  // No direct writes: only through submit_order_reviews.
  const direct = await customer.from('product_reviews').insert({
    order_item_id: itemId,
    order_id: orderId,
    store_id: sql(`select id from stores where slug = '${STORE_SLUG}'`),
    rating: 5,
  })
  expect(direct.error?.code).toBe('42501')

  // Over 300 characters is refused by the database itself.
  const long = await customer.rpc('submit_order_reviews', {
    p_order_id: orderId,
    p_rating: 5,
    p_comment: '',
    p_items: [{ order_item_id: itemId, rating: 5, comment: 'x'.repeat(301) }],
  })
  expect(long.error?.code).toBe('23514')

  // An item from another order.
  const other = deliveredOrder()
  const foreign = await customer.rpc('submit_order_reviews', {
    p_order_id: orderId,
    p_rating: 5,
    p_comment: '',
    p_items: [{ order_item_id: other.itemId, rating: 5 }],
  })
  expect(foreign.error?.code).toBe('42501')

  // The owner manages the dish, not its rating.
  const owner = createClient(API_URL!, API_KEY!, {
    auth: { persistSession: false },
  })
  await owner.auth.signInWithPassword({ email: OWNER, password: PASSWORD })
  const inflate = await owner
    .from('products')
    .update({ rating_avg: 5, rating_count: 999 })
    .eq('id', product.id)
  expect(inflate.error?.code).toBe('42501')
})
