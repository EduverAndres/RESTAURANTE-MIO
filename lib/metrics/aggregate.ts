// Pure aggregations behind /dashboard/metrics. No React, no Supabase.
import { startOfLocalDay } from '@/lib/dates'
import type { OrderStatus } from '@/types/app'

export type MetricsPeriod = 'hoy' | '7d' | '30d'

export const METRICS_PERIODS: readonly {
  value: MetricsPeriod
  label: string
  days: number
}[] = [
  { value: 'hoy', label: 'Hoy', days: 1 },
  { value: '7d', label: '7 días', days: 7 },
  { value: '30d', label: '30 días', days: 30 },
]

export function parsePeriod(value: string | undefined): MetricsPeriod {
  const match = METRICS_PERIODS.find((period) => period.value === value)
  return match ? match.value : 'hoy'
}

export interface PeriodBounds {
  period: MetricsPeriod
  start: Date
  end: Date
  days: number
}

/** Local-day window ending at `now`; `days` includes today. */
export function periodBounds(period: MetricsPeriod, now: Date): PeriodBounds {
  const days =
    METRICS_PERIODS.find((entry) => entry.value === period)?.days ?? 1
  const start = startOfLocalDay(now)
  start.setDate(start.getDate() - (days - 1))
  return { period, start, end: now, days }
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

export interface MetricsOrder {
  id: string
  status: OrderStatus
  total: number
  created_at: string
}

export interface Kpis {
  orders: number
  /** Sum of `total` for delivered orders. */
  revenue: number
  averageTicket: number
  /** Cancelled orders as a percentage of all orders, one decimal. */
  cancelledPct: number
}

export function computeKpis(orders: readonly MetricsOrder[]): Kpis {
  const delivered = orders.filter((order) => order.status === 'delivered')
  const cancelled = orders.filter((order) => order.status === 'cancelled')
  const revenue = delivered.reduce((sum, order) => sum + order.total, 0)
  return {
    orders: orders.length,
    revenue,
    averageTicket: delivered.length
      ? Math.round(revenue / delivered.length)
      : 0,
    cancelledPct: orders.length
      ? Math.round((cancelled.length / orders.length) * 1000) / 10
      : 0,
  }
}

// ---------------------------------------------------------------------------
// Series
// ---------------------------------------------------------------------------

export interface SeriesPoint {
  key: string
  label: string
  orders: number
  revenue: number
}

const SHORT_MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sept',
  'oct',
  'nov',
  'dic',
]

function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function dayLabel(date: Date): string {
  return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}`
}

function inBounds(order: MetricsOrder, bounds: PeriodBounds): boolean {
  const time = new Date(order.created_at).getTime()
  return time >= bounds.start.getTime() && time <= bounds.end.getTime()
}

/**
 * One point per hour for "hoy", one per day otherwise. Revenue only counts
 * delivered orders, matching the KPI definition.
 */
export function buildSeries(
  orders: readonly MetricsOrder[],
  bounds: PeriodBounds,
): SeriesPoint[] {
  const hourly = bounds.period === 'hoy'
  const points: SeriesPoint[] = hourly
    ? Array.from({ length: 24 }, (_, hour) => ({
        key: String(hour).padStart(2, '0'),
        label: `${hour} h`,
        orders: 0,
        revenue: 0,
      }))
    : Array.from({ length: bounds.days }, (_, offset) => {
        const date = new Date(bounds.start)
        date.setDate(date.getDate() + offset)
        return {
          key: dayKey(date),
          label: dayLabel(date),
          orders: 0,
          revenue: 0,
        }
      })
  const index = new Map(points.map((point, position) => [point.key, position]))

  for (const order of orders) {
    if (!inBounds(order, bounds)) continue
    const date = new Date(order.created_at)
    const key = hourly ? String(date.getHours()).padStart(2, '0') : dayKey(date)
    const position = index.get(key)
    if (position === undefined) continue
    points[position].orders += 1
    if (order.status === 'delivered') points[position].revenue += order.total
  }
  return points
}

// ---------------------------------------------------------------------------
// Top products
// ---------------------------------------------------------------------------

export interface MetricsItem {
  order_id: string
  product_id: string | null
  name_snapshot: string
  quantity: number
}

export interface TopProduct {
  key: string
  name: string
  quantity: number
}

/** Best sellers by units, ignoring cancelled orders. */
export function topProducts(
  items: readonly MetricsItem[],
  orders: readonly MetricsOrder[],
  limit = 5,
): TopProduct[] {
  const cancelled = new Set(
    orders.filter((order) => order.status === 'cancelled').map((o) => o.id),
  )
  const totals = new Map<string, TopProduct>()
  for (const item of items) {
    if (cancelled.has(item.order_id)) continue
    const key = item.product_id ?? `name:${item.name_snapshot}`
    const existing = totals.get(key)
    if (existing) existing.quantity += item.quantity
    else
      totals.set(key, {
        key,
        name: item.name_snapshot,
        quantity: item.quantity,
      })
  }
  return [...totals.values()]
    .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name))
    .slice(0, limit)
}

// ---------------------------------------------------------------------------
// Platform KPIs (admin)
// ---------------------------------------------------------------------------

export interface PlatformOrder {
  store_id: string
  status: OrderStatus
  subtotal: number
  platform_fee: number
}

export interface PlatformKpis {
  orders: number
  /** GMV: sum of `subtotal` for delivered orders, across every store. */
  gmv: number
  /** Sum of `platform_fee` for delivered orders. */
  commission: number
  /** Distinct stores with at least one order in the period. */
  activeStores: number
}

export function computePlatformKpis(
  orders: readonly PlatformOrder[],
): PlatformKpis {
  const delivered = orders.filter((order) => order.status === 'delivered')
  return {
    orders: orders.length,
    gmv: delivered.reduce((sum, order) => sum + order.subtotal, 0),
    commission: delivered.reduce((sum, order) => sum + order.platform_fee, 0),
    activeStores: new Set(orders.map((order) => order.store_id)).size,
  }
}
