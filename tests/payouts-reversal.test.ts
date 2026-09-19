import { describe, expect, it } from 'vitest'
import { summarizePayouts, type PayoutOrderInput } from '@/lib/payouts/compute'
import {
  REFUND_REVERSES_PLATFORM_FEE,
  isDebtToPlatform,
  needsReversal,
  planReversals,
  reverseRefundedOrder,
  type RefundedOrderInput,
  type SettledPayout,
} from '@/lib/payouts/reversal'

const PERIOD = { periodStart: '2026-09-14', periodEnd: '2026-09-20' }

function refunded(
  overrides: Partial<RefundedOrderInput> = {},
): RefundedOrderInput {
  return {
    refund_id: 'refund-1',
    order_id: 'order-1',
    store_id: 'store-1',
    subtotal: 10000,
    platform_fee: 600,
    delivered_at: '2026-09-08T12:00:00.000Z',
    refunded_at: '2026-09-16T10:00:00.000Z',
    ...overrides,
  }
}

/** The payout for the week the order above was delivered in. */
function settled(overrides: Partial<SettledPayout> = {}): SettledPayout {
  return {
    store_id: 'store-1',
    period_start: '2026-09-07',
    period_end: '2026-09-13',
    created_at: '2026-09-14T06:00:00.000Z',
    ...overrides,
  }
}

function order(overrides: Partial<PayoutOrderInput> = {}): PayoutOrderInput {
  return {
    store_id: 'store-1',
    status: 'delivered',
    subtotal: 10000,
    platform_fee: 600,
    delivered_at: '2026-09-15T12:00:00.000Z',
    payment_method: 'wompi',
    payment_status: 'paid',
    ...overrides,
  }
}

describe('reverseRefundedOrder', () => {
  it('reverses the subtotal and the platform commission together', () => {
    // The documented assumption: on a fully refunded order the sale did not
    // happen, so the platform gives its commission back too.
    expect(REFUND_REVERSES_PLATFORM_FEE).toBe(true)
    expect(reverseRefundedOrder(refunded())).toEqual({
      refund_id: 'refund-1',
      order_id: 'order-1',
      store_id: 'store-1',
      gross: -10000,
      commission: -600,
      net: -9400,
    })
  })

  it('reverses exactly what the merchant was paid', () => {
    // The payout paid net = subtotal - platform_fee; the reversal takes the
    // same number back, never more.
    const adjustment = reverseRefundedOrder(
      refunded({ subtotal: 50000, platform_fee: 4000 }),
    )
    expect(adjustment.net).toBe(-(50000 - 4000))
  })
})

describe('needsReversal', () => {
  it('is false when the order was refunded before its period was generated', () => {
    // Generation then excluded it through isEligible, so there is nothing to
    // take back: the merchant was never paid for this order.
    expect(
      needsReversal(refunded({ refunded_at: '2026-09-13T09:00:00.000Z' }), [
        settled({ created_at: '2026-09-14T06:00:00.000Z' }),
      ]),
    ).toBe(false)
  })

  it('is true when the order was refunded after its period was generated', () => {
    expect(
      needsReversal(refunded({ refunded_at: '2026-09-16T10:00:00.000Z' }), [
        settled({ created_at: '2026-09-14T06:00:00.000Z' }),
      ]),
    ).toBe(true)
  })

  it('does not care whether that payout was already marked paid', () => {
    // Refunded after generation but before payment is the same money as
    // refunded after payment: the settled row is never mutated either way.
    const before = needsReversal(refunded(), [settled()])
    const after = needsReversal(refunded({ refunded_at: '2026-10-01T10:00:00.000Z' }), [
      settled(),
    ])
    expect(before).toBe(true)
    expect(after).toBe(true)
  })

  it('is false when no payout covers the delivery date yet', () => {
    expect(needsReversal(refunded(), [])).toBe(false)
  })

  it('is false when the covering payout belongs to another store', () => {
    expect(needsReversal(refunded(), [settled({ store_id: 'store-2' })])).toBe(
      false,
    )
  })

  it('is false for an order that was never delivered', () => {
    expect(needsReversal(refunded({ delivered_at: null }), [settled()])).toBe(
      false,
    )
  })

  it('includes both ends of the payout period', () => {
    const payouts = [settled()]
    expect(
      needsReversal(refunded({ delivered_at: '2026-09-07T00:00:00.000Z' }), payouts),
    ).toBe(true)
    expect(
      needsReversal(refunded({ delivered_at: '2026-09-13T23:59:59.000Z' }), payouts),
    ).toBe(true)
    expect(
      needsReversal(refunded({ delivered_at: '2026-09-14T00:00:00.000Z' }), payouts),
    ).toBe(false)
  })
})

describe('planReversals', () => {
  it('carries an adjustment only for refunds that were already settled', () => {
    const plan = planReversals(
      [
        refunded({ refund_id: 'settled', refunded_at: '2026-09-16T10:00:00.000Z' }),
        refunded({
          refund_id: 'never-settled',
          order_id: 'order-2',
          refunded_at: '2026-09-13T09:00:00.000Z',
        }),
      ],
      [settled()],
    )

    expect(plan.adjustments.map((a) => a.refund_id)).toEqual(['settled'])
    // Both are resolved: the second will never produce an adjustment, so
    // leaving it pending would make generation reconsider it forever.
    expect(plan.resolvedRefundIds.sort()).toEqual(['never-settled', 'settled'])
  })

  it('does not drop an adjustment into a period that ended before the refund', () => {
    // The admin can generate any period, including an old one. A refund
    // recorded on the 16th has no business appearing in the week ending on
    // the 13th: it stays pending until a period that could contain it runs.
    const plan = planReversals(
      [refunded({ refunded_at: '2026-09-16T10:00:00.000Z' })],
      [settled()],
      { periodStart: '2026-09-07', periodEnd: '2026-09-13' },
    )
    expect(plan.adjustments).toEqual([])
    expect(plan.resolvedRefundIds).toEqual([])
  })

  it('carries a refund into a period that ends on the refund day', () => {
    const plan = planReversals(
      [refunded({ refunded_at: '2026-09-16T10:00:00.000Z' })],
      [settled()],
      { periodStart: '2026-09-14', periodEnd: '2026-09-16' },
    )
    expect(plan.adjustments).toHaveLength(1)
  })

  it('sums two refunds from the same period for the same store', () => {
    const plan = planReversals(
      [
        refunded({ refund_id: 'r1', order_id: 'o1', subtotal: 10000, platform_fee: 600 }),
        refunded({ refund_id: 'r2', order_id: 'o2', subtotal: 25000, platform_fee: 1500 }),
      ],
      [settled()],
    )
    const total = plan.adjustments.reduce(
      (sum, adjustment) => sum + adjustment.net,
      0,
    )
    expect(plan.adjustments).toHaveLength(2)
    expect(total).toBe(-(10000 - 600) - (25000 - 1500))
  })
})

describe('summarizePayouts with adjustments', () => {
  it('drops an order refunded before generation without any adjustment', () => {
    const rows = summarizePayouts(
      [order({ payment_status: 'refunded' })],
      PERIOD,
      [],
    )
    expect(rows).toEqual([])
  })

  it('subtracts a carried adjustment from the next period', () => {
    const rows = summarizePayouts([order()], PERIOD, [
      reverseRefundedOrder(refunded({ subtotal: 4000, platform_fee: 240 })),
    ])
    expect(rows).toEqual([
      {
        store_id: 'store-1',
        period_start: '2026-09-14',
        period_end: '2026-09-20',
        gross: 10000 - 4000,
        commission: 600 - 240,
        net: 10000 - 4000 - (600 - 240),
      },
    ])
  })

  it('emits a row for a store whose only activity is an adjustment', () => {
    const rows = summarizePayouts([], PERIOD, [
      reverseRefundedOrder(refunded()),
    ])
    expect(rows).toEqual([
      {
        store_id: 'store-1',
        period_start: '2026-09-14',
        period_end: '2026-09-20',
        gross: -10000,
        commission: -600,
        net: -9400,
      },
    ])
  })

  it('lets the period go negative rather than silently clamping to zero', () => {
    // The merchant owes the platform. Hiding that at zero would quietly
    // forgive the difference; the debt is carried as a negative payout and
    // `isDebtToPlatform` is what the UI reads to say so out loud.
    const rows = summarizePayouts([order({ subtotal: 1000, platform_fee: 60 })], PERIOD, [
      reverseRefundedOrder(refunded({ subtotal: 50000, platform_fee: 3000 })),
    ])
    expect(rows[0].gross).toBe(1000 - 50000)
    expect(rows[0].net).toBe(-(50000 - 3000) + (1000 - 60))
    expect(isDebtToPlatform(rows[0])).toBe(true)
  })

  it('keeps a healthy period out of debt', () => {
    const rows = summarizePayouts([order()], PERIOD, [])
    expect(isDebtToPlatform(rows[0])).toBe(false)
  })

  it('does not leak one store’s adjustment into another store', () => {
    const rows = summarizePayouts(
      [order({ store_id: 'store-1' }), order({ store_id: 'store-2' })],
      PERIOD,
      [reverseRefundedOrder(refunded({ store_id: 'store-2' }))],
    )
    expect(rows.map((row) => [row.store_id, row.net])).toEqual([
      ['store-1', 9400],
      ['store-2', 9400 - 9400],
    ])
  })
})
