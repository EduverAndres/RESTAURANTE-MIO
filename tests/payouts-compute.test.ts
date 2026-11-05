import { describe, expect, it } from 'vitest'
import {
  periodEndExclusive,
  summarizePayouts,
  type PayoutOrderInput,
} from '@/lib/payouts/compute'

function order(overrides: Partial<PayoutOrderInput>): PayoutOrderInput {
  return {
    store_id: 'store-1',
    status: 'delivered',
    type: 'delivery',
    courier_id: 'courier-1',
    subtotal: 10000,
    platform_fee: 600,
    merchant_discount: 0,
    platform_discount: 0,
    delivered_at: '2026-09-08T12:00:00.000Z',
    payment_method: 'wompi',
    payment_status: 'paid',
    ...overrides,
  }
}

const PERIOD = { periodStart: '2026-09-07', periodEnd: '2026-09-13' }

describe('periodEndExclusive', () => {
  it('returns UTC midnight of the day after the date-only value', () => {
    expect(periodEndExclusive('2026-09-13').toISOString()).toBe(
      '2026-09-14T00:00:00.000Z',
    )
  })

  it('rolls over month and year boundaries', () => {
    expect(periodEndExclusive('2026-12-31').toISOString()).toBe(
      '2027-01-01T00:00:00.000Z',
    )
  })
})

describe('summarizePayouts', () => {
  it('sums gross, commission and net per store', () => {
    const rows = summarizePayouts(
      [
        order({ store_id: 'store-1', subtotal: 10000, platform_fee: 600 }),
        order({ store_id: 'store-1', subtotal: 20000, platform_fee: 1200 }),
        order({ store_id: 'store-2', subtotal: 5000, platform_fee: 300 }),
      ],
      PERIOD,
    )

    expect(rows).toEqual([
      {
        store_id: 'store-1',
        period_start: '2026-09-07',
        period_end: '2026-09-13',
        gross: 30000,
        commission: 1800,
        cash_collected: 0,
        plan_fee: 0,
        net: 28200,
      },
      {
        store_id: 'store-2',
        period_start: '2026-09-07',
        period_end: '2026-09-13',
        gross: 5000,
        commission: 300,
        cash_collected: 0,
        plan_fee: 0,
        net: 4700,
      },
    ])
  })

  it('excludes orders that are not delivered', () => {
    const rows = summarizePayouts(
      [order({ status: 'preparing' }), order({ status: 'cancelled' })],
      PERIOD,
    )
    expect(rows).toEqual([])
  })

  it('is eligible when payment_status is paid, regardless of method', () => {
    const rows = summarizePayouts(
      [order({ payment_method: 'mock', payment_status: 'paid' })],
      PERIOD,
    )
    expect(rows).toHaveLength(1)
  })

  it('is eligible for cash orders even when payment_status stays pending', () => {
    const rows = summarizePayouts(
      [
        order({
          payment_method: 'cash',
          payment_status: 'pending',
          subtotal: 8000,
          platform_fee: 480,
        }),
      ],
      PERIOD,
    )
    expect(rows).toEqual([
      {
        store_id: 'store-1',
        period_start: '2026-09-07',
        period_end: '2026-09-13',
        gross: 8000,
        commission: 480,
        cash_collected: 0,
        plan_fee: 0,
        net: 7520,
      },
    ])
  })

  it('excludes a non-cash order whose payment is not paid', () => {
    const rows = summarizePayouts(
      [
        order({ payment_method: 'wompi', payment_status: 'pending' }),
        order({ payment_method: 'wompi', payment_status: 'failed' }),
      ],
      PERIOD,
    )
    expect(rows).toEqual([])
  })

  it('excludes orders delivered before the period', () => {
    const rows = summarizePayouts(
      [order({ delivered_at: '2026-09-06T23:59:59.000Z' })],
      PERIOD,
    )
    expect(rows).toEqual([])
  })

  it('excludes orders delivered on or after the day after periodEnd', () => {
    const rows = summarizePayouts(
      [order({ delivered_at: '2026-09-14T00:00:00.000Z' })],
      PERIOD,
    )
    expect(rows).toEqual([])
  })

  it('includes an order delivered exactly at the start of periodStart', () => {
    const rows = summarizePayouts(
      [order({ delivered_at: '2026-09-07T00:00:00.000Z' })],
      PERIOD,
    )
    expect(rows).toHaveLength(1)
  })

  it('includes an order delivered at the last instant of periodEnd', () => {
    const rows = summarizePayouts(
      [order({ delivered_at: '2026-09-13T23:59:59.999Z' })],
      PERIOD,
    )
    expect(rows).toHaveLength(1)
  })

  it('excludes delivered orders with no delivered_at timestamp', () => {
    const rows = summarizePayouts([order({ delivered_at: null })], PERIOD)
    expect(rows).toEqual([])
  })

  it('returns an empty array for no orders', () => {
    expect(summarizePayouts([], PERIOD)).toEqual([])
  })
})

describe('cash the merchant already holds', () => {
  it('is never transferred: the merchant owes the commission instead', () => {
    for (const overrides of [
      { type: 'pickup' as const, courier_id: null },
      { type: 'table' as const, courier_id: null },
      // A delivery the merchant made with their own rider.
      { type: 'delivery' as const, courier_id: null },
    ]) {
      const [row] = summarizePayouts(
        [
          order({
            payment_method: 'cash',
            payment_status: 'pending',
            ...overrides,
          }),
        ],
        PERIOD,
      )
      expect(row, overrides.type).toMatchObject({
        gross: 10000,
        commission: 600,
        cash_collected: 10000,
        net: -600,
      })
    }
  })

  it('is still owed to the merchant when a platform courier collected it', () => {
    const [row] = summarizePayouts(
      [
        order({
          payment_method: 'cash',
          payment_status: 'pending',
          type: 'delivery',
          courier_id: 'courier-1',
        }),
      ],
      PERIOD,
    )
    expect(row).toMatchObject({ cash_collected: 0, net: 9400 })
  })

  it('nets against online sales in the same period', () => {
    const [row] = summarizePayouts(
      [
        order({ payment_method: 'wompi', subtotal: 20000, platform_fee: 2200 }),
        order({
          payment_method: 'cash',
          payment_status: 'pending',
          type: 'pickup',
          courier_id: null,
          subtotal: 10000,
          platform_fee: 600,
          merchant_discount: 0,
          platform_discount: 0,
        }),
      ],
      PERIOD,
    )
    // 30.000 sold, 20.000 of it through the platform, minus 2.800 commission.
    expect(row).toMatchObject({
      gross: 30000,
      commission: 2800,
      cash_collected: 10000,
      net: 17200,
    })
  })
})

describe('plan fees', () => {
  it('produce a row, and a debt, for a store that sold nothing', () => {
    expect(
      summarizePayouts(
        [],
        PERIOD,
        [],
        [{ store_id: 'store-9', plan_fee: 30310 }],
      ),
    ).toEqual([
      {
        store_id: 'store-9',
        period_start: '2026-09-07',
        period_end: '2026-09-13',
        gross: 0,
        commission: 0,
        cash_collected: 0,
        plan_fee: 30310,
        net: -30310,
      },
    ])
  })

  it('come out of the net of a store that did sell, and zero fees add nothing', () => {
    const rows = summarizePayouts(
      [order({})],
      PERIOD,
      [],
      [
        { store_id: 'store-1', plan_fee: 11643 },
        { store_id: 'store-2', plan_fee: 0 },
      ],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ plan_fee: 11643, net: 10000 - 600 - 11643 })
  })
})

describe('discounts', () => {
  it('settle the store on its sale net of its own coupon', () => {
    const [row] = summarizePayouts(
      [order({ subtotal: 30000, merchant_discount: 3000, platform_fee: 2970 })],
      PERIOD,
    )
    // Online order: 27.000 sold, 11 % of it as commission.
    expect(row).toMatchObject({ gross: 27000, commission: 2970, net: 24030 })
  })

  it('make the platform pay the referral credit on a cash sale', () => {
    const [row] = summarizePayouts(
      [
        order({
          payment_method: 'cash',
          payment_status: 'pending',
          type: 'pickup',
          courier_id: null,
          subtotal: 30000,
          platform_discount: 5000,
          platform_fee: 1800,
        }),
      ],
      PERIOD,
    )
    // The customer handed over 25.000; the store sold 30.000 and owes 1.800
    // of commission, so the platform owes it 5.000 - 1.800.
    expect(row).toMatchObject({
      gross: 30000,
      cash_collected: 25000,
      commission: 1800,
      net: 3200,
    })
  })
})
