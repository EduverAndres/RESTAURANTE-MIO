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
    subtotal: 10000,
    platform_fee: 600,
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
        net: 28200,
      },
      {
        store_id: 'store-2',
        period_start: '2026-09-07',
        period_end: '2026-09-13',
        gross: 5000,
        commission: 300,
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
