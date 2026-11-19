// @vitest-environment node
// Reads a .sql file as text; under jsdom `import.meta.url` is not a file://
// URL, so it cannot be resolved back to a path.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  isCollectedByMerchant,
  isEligible,
  type PayoutOrderInput,
} from '@/lib/payouts/compute'
import { REFUND_REVERSES_PLATFORM_FEE } from '@/lib/payouts/reversal'
import {
  MERCHANT_COLLECTED_RULE,
  payoutSqlBlocks,
  PAYOUT_ELIGIBLE_RULE,
} from '@/lib/payouts/sql'
import type {
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
} from '@/types/app'

// ---------------------------------------------------------------------------
// Payout generation runs inside one database transaction, so the decisions it
// makes exist twice: in `lib/payouts/` for the app, and in SQL for the
// transaction. This suite is the reason that is safe rather than merely fast.
// ---------------------------------------------------------------------------

const ORDER_STATUSES: readonly OrderStatus[] = [
  'pending',
  'accepted',
  'preparing',
  'ready',
  'picked_up',
  'delivered',
  'cancelled',
]
const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'pending',
  'paid',
  'failed',
  'refunded',
]
const PAYMENT_METHODS: readonly PaymentMethod[] = [
  'cash',
  'wompi',
  'mercadopago',
  'mock',
]

function order(
  status: OrderStatus,
  payment_status: PaymentStatus,
  payment_method: PaymentMethod,
): PayoutOrderInput {
  return {
    store_id: 'store-1',
    status,
    type: 'delivery',
    courier_id: 'courier-1',
    subtotal: 10000,
    platform_fee: 600,
    merchant_discount: 0,
    platform_discount: 0,
    delivered_at: '2026-09-15T12:00:00.000Z',
    payment_method,
    payment_status,
  }
}

describe('the SQL mirror of the eligibility rule', () => {
  it('agrees with isEligible on every reachable order state', () => {
    // Exhaustive rather than sampled: the whole input space is 112 rows, and
    // a rule that agrees on the cases someone thought of is exactly the rule
    // that drifts on the one they did not.
    for (const status of ORDER_STATUSES) {
      for (const paymentStatus of PAYMENT_STATUSES) {
        for (const method of PAYMENT_METHODS) {
          const input = order(status, paymentStatus, method)
          expect(
            PAYOUT_ELIGIBLE_RULE.matches(input),
            `${status}/${paymentStatus}/${method}`,
          ).toBe(isEligible(input))
        }
      }
    }
  })
})

const ORDER_TYPES: readonly OrderType[] = ['delivery', 'pickup', 'table']

describe('the SQL mirror of the cash-held-by-merchant rule', () => {
  it('agrees with isCollectedByMerchant on every method, type and courier', () => {
    for (const method of PAYMENT_METHODS) {
      for (const type of ORDER_TYPES) {
        for (const courier_id of [null, 'courier-1']) {
          const input = { payment_method: method, type, courier_id }
          expect(
            MERCHANT_COLLECTED_RULE.matches(input),
            `${method}/${type}/${courier_id ?? 'sin domiciliario'}`,
          ).toBe(isCollectedByMerchant(input))
        }
      }
    }
  })
})

describe('the SQL mirror of the commission reversal', () => {
  it('follows REFUND_REVERSES_PLATFORM_FEE', () => {
    // Flipping that constant must not be able to mean one thing to the app
    // and another to the ledger.
    expect(payoutSqlBlocks().reversal_commission).toBe(
      REFUND_REVERSES_PLATFORM_FEE ? '-o.platform_fee' : '0',
    )
  })
})

// ---------------------------------------------------------------------------
// The migration embeds the emitted SQL between `codegen:` markers, the same
// way `scripts/audit-unapplied-events.sql` does. This is the test that fails
// when the function in the database and the rules in `lib/` disagree.
// ---------------------------------------------------------------------------
const SQL_PATH = fileURLToPath(
  new URL(
    // The latest migration that defines public.generate_payouts.
    '../supabase/migrations/20261105000300_discounts_loyalty_referrals.sql',
    import.meta.url,
  ),
)

/** Windows checks this file out with CRLF; compare on LF only. */
function readSql(): string {
  return readFileSync(SQL_PATH, 'utf8').replace(/\r\n/g, '\n')
}

function block(name: string): string {
  const sql = readSql()
  const begin = `-- codegen:begin(${name})`
  const end = `-- codegen:end(${name})`
  const from = sql.indexOf(begin)
  const to = sql.indexOf(end)
  expect(from, `missing ${begin}`).toBeGreaterThan(-1)
  expect(to, `missing ${end}`).toBeGreaterThan(from)
  expect(sql.indexOf(begin, from + 1), `duplicate ${begin}`).toBe(-1)
  return sql.slice(from + begin.length, to).trim()
}

describe('20261105000300_discounts_loyalty_referrals.sql', () => {
  it('embeds every generated block verbatim', () => {
    for (const [name, sql] of Object.entries(payoutSqlBlocks())) {
      expect(block(name), name).toBe(sql)
    }
  })

  it('pins period bounds to UTC, like periodEndExclusive does', () => {
    // A bare `::timestamptz` would be read in the session's time zone and
    // move every period boundary by the deployment's offset.
    expect(readSql()).not.toMatch(/period_(start|end)::timestamptz/)
    expect(readSql()).toContain(
      "(p_period_start::timestamp at time zone 'UTC')",
    )
  })
})
