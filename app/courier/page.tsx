import { CourierBoard } from '@/components/courier/courier-board'
import { requireRole } from '@/lib/auth'
import {
  splitCourierOrders,
  toCourierOrderSummary,
  type CourierOrderRow,
} from '@/lib/courier/orders'
import { fetchAddressesById } from '@/lib/courier/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ORDER_COLUMNS =
  'id, short_code, status, created_at, delivery_fee, estimated_at, address_id, stores(name, lat, lng)'
const HISTORY_LIMIT = 20

export default async function CourierPage() {
  const { user } = await requireRole(['courier', 'admin'], '/courier')
  const supabase = await createClient()

  // RLS already limits the pool to unclaimed, ready deliveries; the filters
  // are repeated so admins (who see everything) get the same list.
  const [{ data: pool }, { data: mine }] = await Promise.all([
    supabase
      .from('orders')
      .select(ORDER_COLUMNS)
      .is('courier_id', null)
      .eq('status', 'ready')
      .eq('type', 'delivery')
      .order('created_at', { ascending: true }),
    supabase
      .from('orders')
      .select(ORDER_COLUMNS)
      .eq('courier_id', user.id)
      .order('created_at', { ascending: false })
      .limit(60),
  ])

  const poolRows: CourierOrderRow[] = pool ?? []
  const mineRows: CourierOrderRow[] = mine ?? []
  const addresses = await fetchAddressesById(
    [...poolRows, ...mineRows].map((row) => row.address_id),
  )
  const summarize = (row: CourierOrderRow) =>
    toCourierOrderSummary(
      row,
      row.address_id ? (addresses.get(row.address_id) ?? null) : null,
    )

  const available = poolRows.map(summarize)
  const { active, history } = splitCourierOrders(mineRows.map(summarize))

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Mis entregas
        </h1>
        <p className="text-muted-foreground text-sm">
          Toma pedidos listos, avanza tus entregas y comparte tu ubicación en
          vivo con los clientes.
        </p>
      </header>
      <CourierBoard
        available={available}
        active={active}
        history={history.slice(0, HISTORY_LIMIT)}
      />
    </div>
  )
}
