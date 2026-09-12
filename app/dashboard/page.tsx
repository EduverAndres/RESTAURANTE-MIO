import type { Metadata } from 'next'
import { OrderBoard } from '@/components/dashboard/orders/order-board'
import { StoreStatusBadge } from '@/components/orders/order-status-badge'
import { requireActiveStore } from '@/lib/dashboard/store-context'
import {
  TERMINAL_STATUSES,
  startOfLocalDay,
  type BoardOrder,
} from '@/lib/orders/kanban'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Pedidos' }
export const dynamic = 'force-dynamic'

async function fetchBoardOrders(storeId: string): Promise<BoardOrder[]> {
  const supabase = await createClient()
  const since = startOfLocalDay(new Date()).toISOString()
  const terminal = TERMINAL_STATUSES.map((status) => `"${status}"`).join(',')
  const { data } = await supabase
    .from('orders')
    .select(
      'id, short_code, status, type, table_number, total, notes, created_at, customer:profiles!orders_customer_id_fkey(full_name), order_items(name_snapshot, quantity)',
    )
    .eq('store_id', storeId)
    .or(`status.not.in.(${terminal}),created_at.gte.${since}`)
    .order('created_at', { ascending: true })
    .limit(200)

  return (data ?? []).map((order) => ({
    id: order.id,
    short_code: order.short_code,
    status: order.status,
    type: order.type,
    table_number: order.table_number,
    total: Number(order.total),
    notes: order.notes,
    created_at: order.created_at,
    customer_name: order.customer?.full_name ?? null,
    items: order.order_items.map((item) => ({
      name: item.name_snapshot,
      quantity: item.quantity,
    })),
  }))
}

export default async function DashboardPage() {
  const { active } = await requireActiveStore('/dashboard')
  const orders = await fetchBoardOrders(active.id)

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Pedidos
          </h1>
          <p className="text-muted-foreground text-sm">
            {active.name} · los pedidos nuevos aparecen al instante.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StoreStatusBadge status={active.status} />
          <span className="text-muted-foreground text-xs">
            {active.is_open ? 'Recibiendo pedidos' : 'Pausada'}
          </span>
        </div>
      </header>
      <OrderBoard storeId={active.id} initial={orders} />
    </div>
  )
}
