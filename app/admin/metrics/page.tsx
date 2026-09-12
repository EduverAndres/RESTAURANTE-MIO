import {
  BanknoteIcon,
  ReceiptTextIcon,
  StoreIcon,
  TrendingUpIcon,
} from 'lucide-react'
import type { Metadata } from 'next'
import { BarChart } from '@/components/dashboard/metrics/bar-chart'
import { KpiTile } from '@/components/dashboard/metrics/kpi-tile'
import {
  PERIOD_PARAM,
  PeriodSelector,
} from '@/components/dashboard/metrics/period-selector'
import { requireRole } from '@/lib/auth'
import { formatCOP } from '@/lib/format'
import {
  buildSeries,
  computePlatformKpis,
  parsePeriod,
  periodBounds,
  type PlatformOrder,
} from '@/lib/metrics/aggregate'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Métricas' }
export const dynamic = 'force-dynamic'

interface AdminMetricsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AdminMetricsPage({
  searchParams,
}: AdminMetricsPageProps) {
  await requireRole(['admin'], '/admin/metrics')
  const params = await searchParams
  const raw = params[PERIOD_PARAM]
  const period = parsePeriod(Array.isArray(raw) ? raw[0] : raw)
  const bounds = periodBounds(period, new Date())

  const supabase = await createClient()
  const [{ data: orders }, { count: activeStoresTotal }] = await Promise.all([
    supabase
      .from('orders')
      .select('store_id, status, subtotal, platform_fee, created_at')
      .gte('created_at', bounds.start.toISOString())
      .limit(20000),
    supabase
      .from('stores')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
  ])

  const platformOrders: PlatformOrder[] = (orders ?? []).map((order) => ({
    store_id: order.store_id,
    status: order.status,
    subtotal: Number(order.subtotal),
    platform_fee: Number(order.platform_fee),
  }))
  const kpis = computePlatformKpis(platformOrders)

  // The same rows, bucketed by time, so the tiles can show a shape as well as
  // a number. `total` here is the order's subtotal, which is exactly what GMV
  // sums — no second query and no second definition of the metric.
  const series = buildSeries(
    (orders ?? []).map((order, index) => ({
      id: String(index),
      status: order.status,
      total: Number(order.subtotal),
      created_at: order.created_at,
    })),
    bounds,
  )

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-h1 font-display font-semibold">Métricas</h1>
          <p className="text-muted-foreground text-sm">
            Cómo va la plataforma. El GMV y la comisión cuentan solo pedidos
            entregados.
          </p>
        </div>
        <PeriodSelector current={period} basePath="/admin/metrics" />
      </header>

      <dl className="gap-card grid sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Pedidos"
          value={String(kpis.orders)}
          icon={ReceiptTextIcon}
          trend={series.map((point) => point.orders)}
        />
        <KpiTile
          label="GMV"
          value={formatCOP(kpis.gmv)}
          icon={TrendingUpIcon}
          trend={series.map((point) => point.revenue)}
        />
        <KpiTile
          label="Comisión"
          value={formatCOP(kpis.commission)}
          icon={BanknoteIcon}
        />
        <KpiTile
          label="Tiendas activas"
          value={String(activeStoresTotal ?? 0)}
          icon={StoreIcon}
          hint={`${kpis.activeStores} con pedidos en el periodo`}
        />
      </dl>

      <BarChart
        title={period === 'hoy' ? 'Pedidos por hora' : 'Pedidos por día'}
        points={series}
      />
    </div>
  )
}
