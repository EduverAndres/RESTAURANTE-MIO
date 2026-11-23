import { describe, expect, it } from 'vitest'
import {
  isCarryable,
  openDebtByStore,
  payoutDisplayStatus,
  planCarries,
  type CarryCandidate,
} from '@/lib/payouts/carry'
import { summarizePayouts, type PayoutOrderInput } from '@/lib/payouts/compute'

const PERIOD = { periodStart: '2026-09-14', periodEnd: '2026-09-20' }

function payout(overrides: Partial<CarryCandidate> = {}): CarryCandidate {
  return {
    id: 'payout-1',
    store_id: 'store-1',
    status: 'pending',
    net: -5000,
    period_end: '2026-09-13',
    carried_into_payout_id: null,
    ...overrides,
  }
}

function order(overrides: Partial<PayoutOrderInput> = {}): PayoutOrderInput {
  return {
    store_id: 'store-1',
    status: 'delivered',
    type: 'delivery',
    courier_id: 'courier-1',
    subtotal: 10000,
    platform_fee: 600,
    merchant_discount: 0,
    platform_discount: 0,
    delivery_fee: 0,
    tip: 0,
    delivered_at: '2026-09-15T12:00:00.000Z',
    payment_method: 'wompi',
    payment_status: 'paid',
    ...overrides,
  }
}

describe('isCarryable', () => {
  it('carries an open debt from an earlier period', () => {
    expect(isCarryable(payout(), PERIOD)).toBe(true)
  })

  it('never carries money the platform owes the store', () => {
    expect(isCarryable(payout({ net: 2000 }), PERIOD)).toBe(false)
    expect(isCarryable(payout({ net: 0 }), PERIOD)).toBe(false)
  })

  it('never carries a debt that was settled or already carried', () => {
    expect(isCarryable(payout({ status: 'paid' }), PERIOD)).toBe(false)
    expect(
      isCarryable(payout({ carried_into_payout_id: 'payout-2' }), PERIOD),
    ).toBe(false)
  })

  it('never carries into a period that does not start after the debt', () => {
    // Generating an old week must not pull in a debt from a later one.
    expect(isCarryable(payout({ period_end: '2026-09-14' }), PERIOD)).toBe(
      false,
    )
    expect(isCarryable(payout({ period_end: '2026-09-27' }), PERIOD)).toBe(
      false,
    )
  })
})

describe('planCarries', () => {
  it('sums each store’s open debts and lists the rows to stamp', () => {
    const plan = planCarries(
      [
        payout({ id: 'a', net: -5000 }),
        payout({ id: 'b', net: -1500, period_end: '2026-09-06' }),
        payout({ id: 'c', store_id: 'store-2', net: -800 }),
        payout({ id: 'd', net: 9000 }),
      ],
      PERIOD,
      new Set(['store-1', 'store-2']),
    )
    expect(plan).toEqual([
      { store_id: 'store-1', carried_in: -6500, payout_ids: ['a', 'b'] },
      { store_id: 'store-2', carried_in: -800, payout_ids: ['c'] },
    ])
  })

  it('leaves a dormant store’s debt open instead of creating a row for it', () => {
    expect(planCarries([payout()], PERIOD, new Set())).toEqual([])
  })
})

describe('summarizePayouts with carried debt', () => {
  it('withholds the debt from what the store is owed this period', () => {
    const [row] = summarizePayouts(
      [order()],
      PERIOD,
      [],
      [],
      [{ store_id: 'store-1', carried_in: -3000 }],
    )
    expect(row).toMatchObject({ carried_in: -3000, net: 10000 - 600 - 3000 })
  })

  it('never creates a row out of a carry alone', () => {
    expect(
      summarizePayouts(
        [],
        PERIOD,
        [],
        [],
        [{ store_id: 'store-1', carried_in: -3000 }],
      ),
    ).toEqual([])
  })

  it('keeps a debt larger than the period’s sales as a new, smaller-or-larger debt', () => {
    const [row] = summarizePayouts(
      [order()],
      PERIOD,
      [],
      [],
      [{ store_id: 'store-1', carried_in: -20000 }],
    )
    expect(row.net).toBe(10000 - 600 - 20000)
  })
})

describe('a chain of carried debts', () => {
  it('counts every peso exactly once', () => {
    // Week 1 ends in debt (-5.000). Week 2 carries it and still ends in debt.
    // Week 3 carries week 2 only, because week 1 is already stamped.
    const week1 = payout({ id: 'w1', net: -5000, period_end: '2026-09-06' })
    const week2Plan = planCarries(
      [week1],
      { periodStart: '2026-09-07' },
      new Set(['store-1']),
    )
    expect(week2Plan[0].carried_in).toBe(-5000)

    const [week2Row] = summarizePayouts(
      [
        order({
          subtotal: 2000,
          platform_fee: 120,
          delivered_at: '2026-09-08T12:00:00.000Z',
        }),
      ],
      { periodStart: '2026-09-07', periodEnd: '2026-09-13' },
      [],
      [],
      week2Plan,
    )
    expect(week2Row.net).toBe(2000 - 120 - 5000)

    const week2 = payout({
      id: 'w2',
      net: week2Row.net,
      period_end: '2026-09-13',
    })
    const stampedWeek1 = { ...week1, carried_into_payout_id: 'w2' }
    const week3Plan = planCarries(
      [stampedWeek1, week2],
      PERIOD,
      new Set(['store-1']),
    )
    expect(week3Plan).toEqual([
      { store_id: 'store-1', carried_in: week2Row.net, payout_ids: ['w2'] },
    ])
  })
})

describe('openDebtByStore', () => {
  it('reports what each store still owes, as a positive amount', () => {
    const debts = openDebtByStore([
      payout({ id: 'a', net: -5000 }),
      payout({ id: 'b', net: -1000, carried_into_payout_id: 'x' }),
      payout({ id: 'c', net: -700, status: 'paid' }),
      payout({ id: 'd', store_id: 'store-2', net: 4000 }),
    ])
    expect([...debts.entries()]).toEqual([['store-1', 5000]])
  })
})

describe('payoutDisplayStatus', () => {
  it('names a carried row as its own state', () => {
    expect(payoutDisplayStatus(payout({ carried_into_payout_id: 'x' }))).toBe(
      'carried',
    )
    expect(payoutDisplayStatus(payout())).toBe('pending')
    expect(payoutDisplayStatus(payout({ status: 'paid' }))).toBe('paid')
  })
})
