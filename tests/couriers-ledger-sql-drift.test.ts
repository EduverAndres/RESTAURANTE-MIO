// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  cashOwedFor,
  courierEntryFor,
  courierPayoutNet,
  isCourierEntryEligible,
  type CourierLedgerOrder,
} from '@/lib/couriers/ledger'
import {
  COURIER_CASH_OWED_SQL,
  COURIER_CASH_SQL,
  COURIER_EARNINGS_SQL,
  COURIER_ENTRY_ELIGIBLE_RULE,
  COURIER_PAYOUT_NET_SQL,
  courierLedgerSqlBlocks,
} from '@/lib/couriers/sql'
import type {
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
} from '@/types/app'

// The delivery trigger, the cash cap and courier payouts run inside the
// database, so each rule exists in SQL and in lib/couriers/ledger.ts. This
// compares them and checks the migration embeds the SQL verbatim.

const STATUSES: readonly OrderStatus[] = [
  'pending',
  'accepted',
  'preparing',
  'ready',
  'picked_up',
  'delivered',
  'cancelled',
]
const TYPES: readonly OrderType[] = ['delivery', 'pickup', 'table']
const METHODS: readonly PaymentMethod[] = [
  'cash',
  'wompi',
  'mercadopago',
  'mock',
]
const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'pending',
  'paid',
  'failed',
  'refunded',
]

const order = (overrides: Partial<CourierLedgerOrder>): CourierLedgerOrder => ({
  status: 'delivered',
  type: 'delivery',
  courier_id: 'courier-1',
  payment_method: 'cash',
  payment_status: 'pending',
  delivery_fee: 5000,
  tip: 2000,
  total: 47000,
  ...overrides,
})

/** Evaluates one of the arithmetic SQL snippets against an order. */
function evaluate(sql: string, prefix: 'new' | 'o', row: CourierLedgerOrder) {
  const js = sql
    .replace(
      new RegExp(
        `\\(case when ${prefix}\\.payment_method = 'cash' then ${prefix}\\.total else 0 end\\)`,
        'g',
      ),
      String(row.payment_method === 'cash' ? row.total : 0),
    )
    .replace(new RegExp(`${prefix}\\.(\\w+)`, 'g'), (_, column: string) =>
      String(row[column as keyof CourierLedgerOrder]),
    )
    .replace(/greatest\(/g, 'Math.max(')
  expect(js).toMatch(/^[\d\s+\-().,Mathmax]+$/)
  return Function(`return ${js}`)() as number
}

describe('the SQL mirror of the delivery trigger', () => {
  it('agrees with isCourierEntryEligible on every reachable order', () => {
    for (const status of STATUSES)
      for (const type of TYPES)
        for (const payment_method of METHODS)
          for (const payment_status of PAYMENT_STATUSES)
            for (const courier_id of [null, 'courier-1']) {
              const row = order({
                status,
                type,
                payment_method,
                payment_status,
                courier_id,
              })
              expect(
                COURIER_ENTRY_ELIGIBLE_RULE.matches(row),
                `${status}/${type}/${payment_method}/${payment_status}/${courier_id}`,
              ).toBe(isCourierEntryEligible(row))
            }
  })

  it('books the same earnings and cash as courierEntryFor', () => {
    for (const payment_method of METHODS) {
      const row = order({ payment_method })
      const entry = courierEntryFor(row)
      expect(evaluate(COURIER_EARNINGS_SQL, 'new', row)).toBe(entry.earnings)
      expect(evaluate(COURIER_CASH_SQL, 'new', row)).toBe(entry.cash_collected)
      expect(evaluate(COURIER_CASH_OWED_SQL, 'o', row)).toBe(cashOwedFor(row))
    }
  })
})

describe('the SQL mirror of the courier payout net', () => {
  it('adds and subtracts the same columns courierPayoutNet does', () => {
    const parts = {
      earnings: 50000,
      cash_collected: 120000,
      adjustments: 80000,
      carried_in: -5000,
    }
    const js = COURIER_PAYOUT_NET_SQL.replace(
      'coalesce(ct.carried_in, 0)',
      `(${parts.carried_in})`,
    ).replace(/\bt\.(\w+)/g, (_, column: string) =>
      String(parts[column as keyof typeof parts]),
    )
    expect(Function(`return ${js}`)()).toBe(courierPayoutNet(parts))
  })
})

const SQL = readFileSync(
  fileURLToPath(
    new URL(
      '../supabase/migrations/20261124000300_courier_ledger.sql',
      import.meta.url,
    ),
  ),
  'utf8',
).replace(/\r\n/g, '\n')

function block(name: string): string {
  const begin = `-- codegen:begin(${name})`
  const end = `-- codegen:end(${name})`
  const from = SQL.indexOf(begin)
  const to = SQL.indexOf(end)
  expect(from, `missing ${begin}`).toBeGreaterThan(-1)
  expect(to, `missing ${end}`).toBeGreaterThan(from)
  expect(SQL.indexOf(begin, from + 1), `duplicate ${begin}`).toBe(-1)
  return SQL.slice(from + begin.length, to).trim()
}

describe('20261124000300_courier_ledger.sql', () => {
  it('embeds every generated block verbatim', () => {
    for (const [name, sql] of Object.entries(courierLedgerSqlBlocks())) {
      expect(block(name), name).toBe(sql)
    }
  })

  it('serialises a courier’s claims before checking the cap', () => {
    const guard = SQL.slice(
      SQL.indexOf('function public.guard_courier_cash_cap'),
    )
    expect(guard.indexOf('for update')).toBeGreaterThan(-1)
    expect(guard.indexOf('for update')).toBeLessThan(
      guard.indexOf("raise exception 'courier_cash_cap'"),
    )
  })

  it('lets nobody but the server write money rows', () => {
    for (const table of ['courier_ledger', 'courier_payouts']) {
      expect(SQL).toContain(
        `revoke all on public.${table} from anon, authenticated;`,
      )
      expect(SQL).toContain(`grant select on public.${table} to authenticated;`)
    }
    expect(SQL).toContain(
      'grant execute on function public.generate_courier_payouts(date, date) to service_role;',
    )
  })

  it('writes one entry per delivered order', () => {
    expect(SQL).toContain(
      "on conflict (order_id) where kind = 'delivery' do nothing;",
    )
  })

  it('follows the migration conventions', () => {
    expect(SQL).toContain("set lock_timeout = '3s';")
    expect(SQL).toContain('reset lock_timeout;')
    expect(SQL).not.toMatch(/^\s*(begin|commit);/m)
  })
})
