// @vitest-environment node
// Reads .sql and .ts files as text; under jsdom `import.meta.url` is not a
// file:// URL, so it cannot be resolved back to a path.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const cache = new Map<string, string>()

/**
 * Reads lazily and memoises: a missing file then fails each assertion that
 * needs it instead of throwing while the suite is collected, which vitest
 * reports as "no tests" and hides the drift.
 */
function read(relative: string): string {
  const cached = cache.get(relative)
  if (cached !== undefined) return cached
  const text = readFileSync(
    fileURLToPath(new URL(relative, import.meta.url)),
    'utf8',
  ).replace(/\r\n/g, '\n')
  cache.set(relative, text)
  return text
}

const MIGRATION =
  '../supabase/migrations/20260919001000_delivery_confirmation.sql'

/**
 * The handover code is enforceable only if three files agree: the migration
 * that creates the table, the trigger that refuses a courier-role delivery
 * without it, and the hand-maintained database types the actions compile
 * against. This suite cannot reach the database; it pins the files.
 */
describe('delivery confirmation migration', () => {
  const sql = () => read(MIGRATION)

  it('keeps the code off orders, in a table couriers have no policy on', () => {
    expect(sql()).toMatch(/create table public\.delivery_codes \(/)
    expect(sql()).toMatch(
      /order_id uuid primary key references public\.orders \(id\) on delete cascade/,
    )
    expect(sql()).toMatch(
      /code text not null check \(code ~ '\^\[0-9\]\{4\}\$'\)/,
    )
    expect(sql()).toMatch(
      /alter table public\.delivery_codes enable row level security/,
    )
    expect(sql()).toMatch(/o\.customer_id = auth\.uid\(\)/)
    expect(sql()).not.toMatch(/delivery_code(?!s)/)
    expect(sql()).not.toMatch(/delivery_codes[^;]*courier_id = auth\.uid\(\)/)
    // Only the customer (select) and admin (all) get policies.
    const policies = sql().match(/create policy "delivery_codes: [^"]+"/g) ?? []
    expect(policies).toEqual([
      'create policy "delivery_codes: admin full access"',
      'create policy "delivery_codes: customer read own"',
    ])
  })

  it('never publishes the table over realtime', () => {
    expect(sql()).not.toMatch(/alter publication[^;]*delivery_codes/)
  })

  it('adds the confirmation columns to orders and accuracy to courier_locations', () => {
    expect(sql()).toMatch(
      /add column delivery_confirmed_by text\s+check \(delivery_confirmed_by in \('code', ?'customer', ?'merchant'\)\)/,
    )
    expect(sql()).toMatch(/add column delivery_confirmed_at timestamptz/)
    expect(sql()).toMatch(
      /alter table public\.courier_locations\s+add column accuracy_m numeric/,
    )
  })

  it('refuses a courier-role update to delivered on a delivery order', () => {
    expect(sql()).toMatch(
      /create or replace function public\.require_delivery_confirmation\(\)/,
    )
    expect(sql()).toMatch(/new\.status = 'delivered'/)
    expect(sql()).toMatch(/old\.status is distinct from 'delivered'/)
    expect(sql()).toMatch(/old\.type = 'delivery'/)
    expect(sql()).toMatch(/auth\.uid\(\) is not null/)
    expect(sql()).toMatch(/public\.user_role_of\(auth\.uid\(\)\) = 'courier'/)
    expect(sql()).toMatch(/errcode = 'insufficient_privilege'/)
    expect(sql()).toMatch(
      /create trigger orders_require_delivery_confirmation\s+before update on public\.orders/,
    )
  })

  it('stays inside the runner transaction and fails fast on locks', () => {
    expect(sql()).not.toMatch(/^\s*(begin|commit)\s*;/im)
    expect(sql()).toMatch(/set lock_timeout = '3s';/)
    expect(sql()).toMatch(/reset lock_timeout;/)
  })

  it('leaves nothing new executable by the browser roles', () => {
    expect(sql()).toMatch(
      /revoke all on function public\.require_delivery_confirmation\(\)\s+from public, anon, authenticated;/,
    )
  })
})

describe('types/database.ts declares the new schema', () => {
  const types = () => read('../types/database.ts')

  it('has the delivery_codes table', () => {
    const table = types().slice(
      types().indexOf('delivery_codes: {'),
      types().indexOf('favorites: {'),
    )
    expect(table).toMatch(/Row: \{[^}]*code: string[^}]*order_id: string/)
    expect(table).toMatch(/Insert: \{[^}]*code: string[^}]*order_id: string/)
    expect(table).toMatch(/referencedRelation: "orders"/)
  })

  it('has the orders confirmation columns', () => {
    const orders = types().slice(
      types().indexOf('orders: {'),
      types().indexOf('orders_customer_id_fkey'),
    )
    expect(orders).toMatch(/delivery_confirmed_at: string \| null/)
    expect(orders).toMatch(/delivery_confirmed_by: string \| null/)
    expect(orders).toMatch(/delivery_confirmed_at\?: string \| null/)
    expect(orders).toMatch(/delivery_confirmed_by\?: string \| null/)
  })

  it('has courier_locations.accuracy_m', () => {
    const locations = types().slice(
      types().indexOf('courier_locations: {'),
      types().indexOf('courier_locations_courier_id_fkey'),
    )
    expect(locations).toMatch(/accuracy_m: number \| null/)
    expect(locations).toMatch(/accuracy_m\?: number \| null/)
  })
})
