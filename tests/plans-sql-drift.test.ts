// @vitest-environment node
// Reads .sql files as text; under jsdom `import.meta.url` is not a file://
// URL, so it cannot be resolved back to a path.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { billableDays, platformFeePct } from '@/lib/plans'
import {
  BILLABLE_DAYS_RULE,
  FEE_PCT_RULE,
  planSqlBlocks,
} from '@/lib/plans-sql'
import type { OrderType, PaymentMethod } from '@/types/app'

// The commission and the plan-fee proration run inside the database. These
// tests keep the SQL and lib/plans.ts saying the same thing.

const TYPES: readonly OrderType[] = ['delivery', 'pickup', 'table']
const METHODS: readonly PaymentMethod[] = [
  'cash',
  'wompi',
  'mercadopago',
  'mock',
]
// Before, on and after the founder's last day, read in Bogotá.
const PLACED_AT = [
  '2026-12-30T20:00:00.000Z',
  '2027-01-01T04:30:00.000Z',
  '2027-01-01T05:30:00.000Z',
  '2027-03-01T15:00:00.000Z',
]
const FOUNDER_UNTIL = [null, '2026-12-31']

describe('the SQL mirror of platformFeePct', () => {
  it('agrees on every type, method, founder state and order date', () => {
    for (const type of TYPES) {
      for (const payment_method of METHODS) {
        for (const created_at of PLACED_AT) {
          for (const founder_until of FOUNDER_UNTIL) {
            const order = { type, payment_method, created_at }
            const store = {
              commission_pct: 6,
              online_payment_pct: 5,
              founder_until,
            }
            expect(
              FEE_PCT_RULE.matches(order, store),
              `${type}/${payment_method}/${created_at}/${founder_until}`,
            ).toBe(platformFeePct(order, store))
          }
        }
      }
    }
  })
})

describe('the SQL mirror of billableDays', () => {
  it('agrees for founder dates before, inside and after the period', () => {
    const period = { periodStart: '2026-11-02', periodEnd: '2026-11-08' }
    const founders: (string | null)[] = [null]
    for (let day = 25; day <= 30; day++) founders.push(`2026-10-${day}`)
    for (let day = 1; day <= 12; day++)
      founders.push(`2026-11-${String(day).padStart(2, '0')}`)
    for (const founderUntil of founders) {
      expect(
        BILLABLE_DAYS_RULE.matches(period, founderUntil),
        String(founderUntil),
      ).toBe(billableDays(period, founderUntil))
    }
  })
})

const PLANS_SQL = fileURLToPath(
  new URL(
    '../supabase/migrations/20261105000100_plans_and_commission.sql',
    import.meta.url,
  ),
)

describe('20261105000100_plans_and_commission.sql', () => {
  it('embeds the fee rule verbatim', () => {
    const sql = readFileSync(PLANS_SQL, 'utf8').replace(/\r\n/g, '\n')
    for (const [name, rule] of Object.entries(planSqlBlocks())) {
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
