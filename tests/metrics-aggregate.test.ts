import { describe, expect, it } from 'vitest'
import {
  METRICS_PERIODS,
  buildSeries,
  computeKpis,
  computePlatformKpis,
  parsePeriod,
  periodBounds,
  topProducts,
  type MetricsItem,
  type MetricsOrder,
  type PlatformOrder,
} from '@/lib/metrics/aggregate'

// Local noon avoids DST edge cases in the day arithmetic below.
const NOW = new Date(2026, 8, 11, 12, 0, 0)

function order(
  id: string,
  status: MetricsOrder['status'],
  total: number,
  createdAt: Date,
): MetricsOrder {
  return { id, status, total, created_at: createdAt.toISOString() }
}

const ORDERS: MetricsOrder[] = [
  order('a', 'delivered', 30_000, new Date(2026, 8, 11, 9)),
  order('b', 'delivered', 50_000, new Date(2026, 8, 11, 11)),
  order('c', 'cancelled', 20_000, new Date(2026, 8, 10, 20)),
  order('d', 'preparing', 15_000, new Date(2026, 8, 9, 11)),
]

describe('parsePeriod', () => {
  it('falls back to today for unknown values', () => {
    expect(parsePeriod('7d')).toBe('7d')
    expect(parsePeriod('30d')).toBe('30d')
    expect(parsePeriod(undefined)).toBe('hoy')
    expect(parsePeriod('year')).toBe('hoy')
    expect(METRICS_PERIODS.map((period) => period.value)).toEqual([
      'hoy',
      '7d',
      '30d',
    ])
  })
})

describe('periodBounds', () => {
  it('starts today at local midnight for hoy', () => {
    const bounds = periodBounds('hoy', NOW)
    expect(bounds.start).toEqual(new Date(2026, 8, 11, 0, 0, 0, 0))
    expect(bounds.end).toEqual(NOW)
    expect(bounds.days).toBe(1)
  })

  it('covers the last 7 and 30 local days inclusive of today', () => {
    expect(periodBounds('7d', NOW).start).toEqual(new Date(2026, 8, 5))
    expect(periodBounds('7d', NOW).days).toBe(7)
    expect(periodBounds('30d', NOW).start).toEqual(new Date(2026, 7, 13))
    expect(periodBounds('30d', NOW).days).toBe(30)
  })
})

describe('computeKpis', () => {
  it('counts orders, sums delivered revenue and derives ticket and cancel rate', () => {
    const kpis = computeKpis(ORDERS)
    expect(kpis.orders).toBe(4)
    expect(kpis.revenue).toBe(80_000)
    expect(kpis.averageTicket).toBe(40_000)
    expect(kpis.cancelledPct).toBe(25)
  })

  it('handles an empty period without dividing by zero', () => {
    expect(computeKpis([])).toEqual({
      orders: 0,
      revenue: 0,
      averageTicket: 0,
      cancelledPct: 0,
    })
  })
})

describe('buildSeries', () => {
  it('buckets by hour for today and ignores cancelled revenue', () => {
    const series = buildSeries(ORDERS, periodBounds('hoy', NOW))
    expect(series).toHaveLength(24)
    expect(series[9]).toEqual({
      key: '09',
      label: '9 h',
      orders: 1,
      revenue: 30_000,
    })
    expect(series[11].revenue).toBe(50_000)
    expect(series[20].orders).toBe(0) // yesterday's cancelled order is out
    expect(series.reduce((sum, point) => sum + point.orders, 0)).toBe(2)
  })

  it('buckets by day for 7d with one point per day, oldest first', () => {
    const series = buildSeries(ORDERS, periodBounds('7d', NOW))
    expect(series).toHaveLength(7)
    expect(series[0].key).toBe('2026-09-05')
    expect(series[6]).toEqual({
      key: '2026-09-11',
      label: '11 sept',
      orders: 2,
      revenue: 80_000,
    })
    expect(series[5]).toEqual({
      key: '2026-09-10',
      label: '10 sept',
      orders: 1,
      revenue: 0,
    })
  })
})

describe('topProducts', () => {
  const items: MetricsItem[] = [
    { order_id: 'a', product_id: 'p1', name_snapshot: 'Bandeja', quantity: 2 },
    { order_id: 'b', product_id: 'p1', name_snapshot: 'Bandeja', quantity: 1 },
    { order_id: 'b', product_id: 'p2', name_snapshot: 'Limonada', quantity: 4 },
    {
      order_id: 'c',
      product_id: 'p3',
      name_snapshot: 'Cancelada',
      quantity: 9,
    },
    { order_id: 'd', product_id: null, name_snapshot: 'Sin id', quantity: 1 },
  ]

  it('ranks by quantity, skips cancelled orders and groups by product id', () => {
    const top = topProducts(items, ORDERS)
    expect(top.map((product) => [product.name, product.quantity])).toEqual([
      ['Limonada', 4],
      ['Bandeja', 3],
      ['Sin id', 1],
    ])
  })

  it('limits the list', () => {
    expect(topProducts(items, ORDERS, 1)).toHaveLength(1)
  })
})

describe('computePlatformKpis', () => {
  function platformOrder(
    overrides: Partial<PlatformOrder> = {},
  ): PlatformOrder {
    return {
      store_id: 'store-1',
      status: 'delivered',
      subtotal: 10_000,
      platform_fee: 600,
      ...overrides,
    }
  }

  it('sums GMV and commission across delivered orders only', () => {
    const kpis = computePlatformKpis([
      platformOrder(),
      platformOrder({ subtotal: 20_000, platform_fee: 1_200 }),
      platformOrder({ status: 'cancelled', subtotal: 99_000 }),
    ])
    expect(kpis.orders).toBe(3)
    expect(kpis.gmv).toBe(30_000)
    expect(kpis.commission).toBe(1_800)
  })

  it('counts distinct stores across every order, not just delivered ones', () => {
    const kpis = computePlatformKpis([
      platformOrder({ store_id: 'store-1' }),
      platformOrder({ store_id: 'store-2', status: 'preparing' }),
      platformOrder({ store_id: 'store-1', status: 'cancelled' }),
    ])
    expect(kpis.activeStores).toBe(2)
  })

  it('returns zeros for no orders', () => {
    expect(computePlatformKpis([])).toEqual({
      orders: 0,
      gmv: 0,
      commission: 0,
      activeStores: 0,
    })
  })
})
