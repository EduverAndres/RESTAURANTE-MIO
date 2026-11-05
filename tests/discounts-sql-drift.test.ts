// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { clampDiscounts } from '@/lib/discounts'
import { DISCOUNT_CLAMP_RULE, discountSqlBlocks } from '@/lib/discounts-sql'
import { collectedAmount, settledGross } from '@/lib/payouts/compute'
import { COLLECTED_AMOUNT_SQL, SETTLED_GROSS_SQL } from '@/lib/payouts/sql'

// Discounts are clamped inside the database on every write. This keeps that
// SQL and lib/discounts.ts in step.

describe('the SQL mirror of clampDiscounts', () => {
  it('agrees over subtotals and discounts around every edge', () => {
    const values = [
      -1000, -0.5, 0, 0.4, 0.5, 1, 2_999.5, 3_000, 4_000, 5_000, 6_000, 30_000,
    ]
    for (const subtotal of values) {
      for (const md of values) {
        for (const pd of values) {
          expect(
            DISCOUNT_CLAMP_RULE.matches(subtotal, md, pd),
            `${subtotal}/${md}/${pd}`,
          ).toEqual(clampDiscounts(subtotal, md, pd))
        }
      }
    }
  })
})

describe('the settlement amounts', () => {
  it('read the same in SQL as in compute.ts', () => {
    const order = {
      subtotal: 30_000,
      merchant_discount: 4_000,
      platform_discount: 5_000,
    }
    expect(settledGross(order)).toBe(26_000)
    expect(collectedAmount(order)).toBe(21_000)
    expect(SETTLED_GROSS_SQL).toBe('(o.subtotal - o.merchant_discount)')
    expect(COLLECTED_AMOUNT_SQL).toBe(
      '(o.subtotal - o.merchant_discount - o.platform_discount)',
    )
  })
})

const SQL_PATH = fileURLToPath(
  new URL(
    '../supabase/migrations/20261105000300_discounts_loyalty_referrals.sql',
    import.meta.url,
  ),
)

describe('20261105000300_discounts_loyalty_referrals.sql', () => {
  it('embeds the discount clamp verbatim', () => {
    const sql = readFileSync(SQL_PATH, 'utf8').replace(/\r\n/g, '\n')
    for (const [name, rule] of Object.entries(discountSqlBlocks())) {
      const begin = `-- codegen:begin(${name})`
      const end = `-- codegen:end(${name})`
      const from = sql.indexOf(begin)
      const to = sql.indexOf(end)
      expect(from, `missing ${begin}`).toBeGreaterThan(-1)
      expect(to, `missing ${end}`).toBeGreaterThan(from)
      expect(sql.slice(from + begin.length, to).trim(), name).toBe(rule)
    }
  })
})
