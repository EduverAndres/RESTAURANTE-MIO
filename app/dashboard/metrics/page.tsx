import {
  BanknoteIcon,
  ReceiptTextIcon,
  StarIcon,
  TrendingUpIcon,
  XCircleIcon,
} from 'lucide-react'
import type { Metadata } from 'next'
import { BarChart } from '@/components/dashboard/metrics/bar-chart'
import { KpiTile } from '@/components/dashboard/metrics/kpi-tile'
import {
  PERIOD_PARAM,
  PeriodSelector,
} from '@/components/dashboard/metrics/period-selector'
import { requireActiveStoreRow } from '@/lib/dashboard/store-context'
import { formatCOP } from '@/lib/format'
import {
  buildSeries,
  computeKpis,
  parsePeriod,
  periodBounds,
  topProducts,
  type MetricsItem,
  type MetricsOrder,
  type PeriodBounds,
} from '@/lib/metrics/aggregate'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Métricas' }
export const dynamic = 'force-dynamic'

interface MetricsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

async function fetchPeriodData(
  storeId: string,
  bounds: PeriodBounds,
): Promise<{ orders: MetricsOrder[]; items: MetricsItem[] }> {
  const supabase = await createClient()
  const since = bounds.start.toISOString()
  const [ordersResult, itemsResult] = await Promise.all([
    supabase
      .from('orders')
      .select('id, status, total, created_at')
      .eq('store_id', storeId)
      .gte('created_at', since)
      .limit(5000),
    supabase
      .from('order_items')
      .select(
        'order_id, product_id, name_snapshot, quantity, orders!inner(store_id, created_at)',
      )
      .eq('orders.store_id', storeId)
      .gte('orders.created_at', since)
      .limit(20000),
  ])
  if (ordersResult.error)
    console.error('Failed to load metrics orders', ordersResult.error)
  if (itemsResult.error)
    console.error('Failed to load metrics items', itemsResult.error)

  return {
    orders: (ordersResult.data ?? []).map((order) => ({
      id: order.id,
      status: order.status,
      total: Number(order.total),
      created_at: order.created_at,
    })),
    items: (itemsResult.data ?? []).map((item) => ({
      order_id: item.order_id,
      product_id: item.product_id,
      name_snapshot: item.name_snapshot,
      quantity: item.quantity,
    })),
  }
}

export default async function MetricsPage({ searchParams }: MetricsPageProps) {
  const { store } = await requireActiveStoreRow('/dashboard/metrics')
  const params = await searchParams
  const raw = params[PERIOD_PARAM]
  const period = parsePeriod(Array.isArray(raw) ? raw[0] : raw)
  const bounds = periodBounds(period, new Date())
  const { orders, items } = await fetchPeriodData(store.id, bounds)

  const kpis = computeKpis(orders)
  const series = buildSeries(orders, bounds)
  const top = topProducts(items, orders)
  const rating = Number(store.rating_avg ?? 0)
  const ratingCount = store.rating_count ?? 0

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-h1 font-display font-semibold">Métricas</h1>
          <p className="text-muted-foreground text-sm">
            Cómo va {store.name}. Los ingresos cuentan solo pedidos entregados.
          </p>
        </div>
        <PeriodSelector current={period} />
      </header>

      {/*
        The two tiles with a real per-bucket series get a sparkline. The other
        three are single numbers for the whole period — drawing a line through
        one point would be decoration pretending to be data.
      */}
      <dl className="gap-card grid sm:grid-cols-2 lg:grid-cols-5">
        <KpiTile
          label="Pedidos"
          value={String(kpis.orders)}
          icon={ReceiptTextIcon}
          trend={series.map((point) => point.orders)}
        />
        <KpiTile
          label="Ingresos"
          value={formatCOP(kpis.revenue)}
          icon={BanknoteIcon}
          trend={series.map((point) => point.revenue)}
        />
        <KpiTile
          label="Ticket promedio"
          value={formatCOP(kpis.averageTicket)}
          icon={TrendingUpIcon}
        />
        <KpiTile
          label="Cancelados"
          value={`${kpis.cancelledPct.toLocaleString('es-CO')} %`}
          icon={XCircleIcon}
        />
        <KpiTile
          label="Valoración"
          value={ratingCount > 0 ? rating.toFixed(1) : '—'}
          icon={StarIcon}
          hint={
            ratingCount > 0
              ? `${ratingCount} reseña${ratingCount === 1 ? '' : 's'}`
              : 'Sin reseñas todavía'
          }
        />
      </dl>

      <div className="gap-inline grid lg:grid-cols-[1fr_320px] lg:items-start">
        <BarChart
          title={period === 'hoy' ? 'Pedidos por hora' : 'Pedidos por día'}
          points={series}
        />
        <section
          aria-labelledby="top-products-title"
          className="rounded-card border-border bg-card shadow-1 p-card border"
        >
          <h2
            id="top-products-title"
            className="font-display mb-3 text-xl font-semibold"
          >
            Más vendidos
          </h2>
          {top.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Aún no hay ventas en este periodo.
            </p>
          ) : (
            <ol className="space-y-2">
              {top.map((product, index) => (
                <li
                  key={product.key}
                  className="flex items-center gap-3 text-sm"
                >
                  <span className="bg-primary/10 text-primary-on-tint flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {product.name}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {product.quantity} und.
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}
