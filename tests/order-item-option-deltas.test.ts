// @vitest-environment node
// Reads a .sql file as text; under jsdom `import.meta.url` is not a file://
// URL, so it cannot be resolved back to a path.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { orderItemRows, type PricedItem } from '@/lib/orders/build-order'
import { computeLineTotal } from '@/lib/pricing'
import type { OrderItemOption } from '@/types/app'

// Resolved through `fileURLToPath`: on Windows a bare `new URL(...)` is not a
// path, and `readFileSync` rejects it. Line endings are normalised because
// `core.autocrlf` is on here and off in CI.
const MIGRATION_PATH = fileURLToPath(
  new URL(
    '../supabase/migrations/20260919000800_option_deltas_in_line_total.sql',
    import.meta.url,
  ),
)

function migrationSql(): string {
  return readFileSync(MIGRATION_PATH, 'utf8').replace(/\r\n/g, '\n')
}

function item(overrides: Partial<PricedItem> = {}): PricedItem {
  return {
    product_id: 'p1',
    name_snapshot: 'Hamburguesa',
    unit_price: 20000,
    quantity: 1,
    options: [],
    notes: '',
    ...overrides,
  }
}

const cheese: OrderItemOption = {
  option: 'Extras',
  value: 'Queso',
  price_delta: 2000,
}
const bacon: OrderItemOption = {
  option: 'Extras',
  value: 'Tocineta',
  price_delta: 3000,
}
const small: OrderItemOption = {
  option: 'Tamaño',
  value: 'Pequeño',
  price_delta: -1500,
}

describe('orderItemRows writes the option surcharge', () => {
  it('carries options_delta as the sum of the chosen deltas', () => {
    const [row] = orderItemRows('o1', [item({ options: [cheese, bacon] })])
    expect(row.options_delta).toBe(5000)
  })

  it('writes 0 when the item has no options', () => {
    const [row] = orderItemRows('o1', [item()])
    expect(row.options_delta).toBe(0)
  })

  it('keeps unit_price as the base catalogue price, surcharges apart', () => {
    const [row] = orderItemRows('o1', [item({ options: [cheese, bacon] })])
    expect(row.unit_price).toBe(20000)
    expect(row.options_delta).toBe(5000)
  })

  it('handles a negative delta, since an option may be a discount', () => {
    const [row] = orderItemRows('o1', [item({ options: [small] })])
    expect(row.options_delta).toBe(-1500)
  })

  it('writes a row per item, each with its own delta', () => {
    const rows = orderItemRows('o1', [
      item({ product_id: 'p1', options: [cheese] }),
      item({ product_id: 'p2', options: [] }),
      item({ product_id: 'p3', options: [bacon, small] }),
    ])
    expect(rows.map((row) => row.options_delta)).toEqual([2000, 0, 1500])
  })
})

/**
 * The invariant the whole bug came down to: `order_items.line_total` is a
 * generated column, and an AFTER trigger overwrites `orders.subtotal` with the
 * sum of it. If that column's arithmetic disagrees with `computeLineTotal` by
 * so much as one option, the database silently rewrites the total the customer
 * was quoted — which is exactly what it was doing.
 */
describe('the stored row reproduces computeLineTotal exactly', () => {
  const cases: Array<{ name: string; item: PricedItem }> = [
    { name: 'no options', item: item() },
    { name: 'one surcharge', item: item({ options: [cheese] }) },
    { name: 'two surcharges', item: item({ options: [cheese, bacon] }) },
    { name: 'a discount', item: item({ options: [small] }) },
    {
      name: 'mixed, quantity 3',
      item: item({ quantity: 3, options: [cheese, bacon, small] }),
    },
    {
      name: 'quantity 7, single surcharge',
      item: item({ quantity: 7, unit_price: 12500, options: [bacon] }),
    },
  ]

  for (const entry of cases) {
    it(`agrees for ${entry.name}`, () => {
      const [row] = orderItemRows('o1', [entry.item])
      const stored =
        (Number(row.unit_price) + Number(row.options_delta)) *
        Number(row.quantity)
      expect(stored).toBe(
        computeLineTotal({
          unitPrice: entry.item.unit_price,
          quantity: entry.item.quantity,
          options: entry.item.options,
        }),
      )
    })
  }
})

/**
 * Drift guard. The arithmetic above only holds while the generated column in
 * the database matches it; nothing else in the suite can reach the schema.
 */
describe('the migration defines line_total with the surcharge', () => {
  it('adds the options_delta column', () => {
    expect(migrationSql()).toMatch(/add column\s+options_delta/i)
  })

  it('regenerates line_total from unit_price plus options_delta', () => {
    expect(migrationSql()).toMatch(
      /generated always as\s*\(\s*\(\s*unit_price\s*\+\s*options_delta\s*\)\s*\*\s*quantity\s*\)\s*stored/i,
    )
  })

  it('backfills options_delta from the stored options json', () => {
    const sql = migrationSql()
    expect(sql).toMatch(/update public\.order_items/i)
    expect(sql).toMatch(/price_delta/i)
  })
})
