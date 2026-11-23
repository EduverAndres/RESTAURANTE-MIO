import { SearchIcon } from 'lucide-react'
import type { Metadata } from 'next'
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from '@/components/orders/order-status-badge'
import { RecordRefundDialog } from '@/components/refunds/record-refund-dialog'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { requireRole } from '@/lib/auth'
import { formatCOP } from '@/lib/format'
import { formatDateCO } from '@/lib/format-date'
import { canRecordRefund } from '@/lib/refunds/plan'
import { createAdminClient } from '@/lib/supabase/admin'
import { throwOnQueryError } from '@/lib/supabase/query-error'
import type { PaymentMethod } from '@/types/app'

export const metadata: Metadata = { title: 'Pedidos' }
export const dynamic = 'force-dynamic'

const LIMIT = 50

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  wompi: 'Wompi',
  mercadopago: 'Mercado Pago',
  mock: 'Prueba',
  corporate: 'Cuenta de empresa',
}

/** Short codes are alphanumeric; anything else is dropped before the query. */
function cleanCode(raw: string | undefined): string {
  return (raw ?? '')
    .replace(/[^0-9a-z]/gi, '')
    .toUpperCase()
    .slice(0, 12)
}

/**
 * Any store's orders, found by their short code.
 *
 * The platform's way to record a refund on a cash order: the merchant cannot
 * (see `canRecordRefund` in `lib/refunds/plan.ts`), so a genuine one comes
 * here, through support, after someone has looked at the case.
 */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string }>
}) {
  await requireRole(['admin'], '/admin/orders')
  const code = cleanCode((await searchParams).codigo)

  let query = createAdminClient()
    .from('orders')
    .select(
      'id, short_code, status, payment_status, payment_method, total, created_at, stores(name)',
    )
    .order('created_at', { ascending: false })
    .limit(LIMIT)
  if (code) query = query.ilike('short_code', `%${code}%`)
  const { data, error } = await query
  throwOnQueryError(error, 'admin orders')
  const orders = data ?? []

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-h1 font-display font-semibold">Pedidos</h1>
        <p className="text-muted-foreground text-sm">
          Busca un pedido por su código. Desde aquí se registran los reembolsos
          de pedidos en efectivo, que el comercio no puede registrar por su
          cuenta.
        </p>
      </header>

      <form role="search" className="flex max-w-md gap-2">
        <label htmlFor="codigo" className="sr-only">
          Código del pedido
        </label>
        <Input
          id="codigo"
          name="codigo"
          defaultValue={code}
          placeholder="Código del pedido, p. ej. A1B2"
          autoComplete="off"
          className="rounded-control h-11"
        />
        <Button type="submit" className="rounded-control h-11">
          <SearchIcon aria-hidden="true" data-icon="inline-start" />
          Buscar
        </Button>
      </form>

      {orders.length === 0 ? (
        <EmptyState
          title={
            code ? 'No hay pedidos con ese código' : 'Todavía no hay pedidos'
          }
          description={
            code
              ? 'Revisa el código que te compartió el cliente o el comercio.'
              : 'Aparecerán aquí a medida que los clientes pidan.'
          }
        />
      ) : (
        <div className="rounded-card bg-card shadow-1 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Tienda</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Reembolso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono font-semibold">
                    #{order.short_code}
                  </TableCell>
                  <TableCell>{order.stores?.name ?? '—'}</TableCell>
                  <TableCell>
                    <OrderStatusBadge status={order.status} />
                  </TableCell>
                  <TableCell>
                    <span className="block text-sm">
                      {PAYMENT_METHOD_LABELS[order.payment_method]}
                    </span>
                    <PaymentStatusBadge status={order.payment_status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCOP(Number(order.total))}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {formatDateCO(order.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    {canRecordRefund(order, 'admin') ? (
                      <RecordRefundDialog
                        variant="admin"
                        orderId={order.id}
                        shortCode={order.short_code}
                        total={Number(order.total)}
                      />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
