import type { Metadata } from 'next'
import Link from 'next/link'
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from '@/components/orders/order-status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  bogotaMonthStart,
  isPeriod,
  periodTitle,
  recentClosedPeriods,
} from '@/lib/companies/period'
import { requireCompanyMember } from '@/lib/companies/server'
import { formatCOP } from '@/lib/format'
import { formatDateCO } from '@/lib/format-date'
import { throwOnQueryError } from '@/lib/supabase/query-error'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Pedidos de la empresa' }
export const dynamic = 'force-dynamic'

export default async function CompanyOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const { budget, supabase } = await requireCompanyMember('/empresa/pedidos')
  const { mes } = await searchParams
  const now = new Date()
  const months = [bogotaMonthStart(now), ...recentClosedPeriods(now, 5)]
  const period = mes && isPeriod(mes) && months.includes(mes) ? mes : months[0]

  const { data, error } = await supabase.rpc('company_orders', {
    p_company_id: budget.companyId,
    p_period: period,
  })
  throwOnQueryError(error, 'company orders')
  const orders = data ?? []
  const isAdmin = budget.role === 'admin'
  const charged = orders
    .filter(
      (order) =>
        order.status !== 'cancelled' && order.payment_status === 'paid',
    )
    .reduce((sum, order) => sum + Number(order.total), 0)

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-h1 font-display font-semibold">
          {isAdmin ? 'Pedidos de la empresa' : 'Mis pedidos de empresa'}
        </h1>
        <p className="text-muted-foreground text-sm text-pretty">
          {isAdmin
            ? 'Todos los pedidos que tu equipo pagó con la cuenta, por mes.'
            : 'Los pedidos que pagaste con la cuenta de tu empresa, por mes.'}
        </p>
      </header>

      <nav aria-label="Mes" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {months.map((month) => (
            <li key={month}>
              <Link
                href={`/empresa/pedidos?mes=${month}`}
                aria-current={month === period ? 'page' : undefined}
                className={cn(
                  'rounded-pill inline-flex h-10 items-center border px-4 text-sm whitespace-nowrap transition-colors',
                  month === period
                    ? 'border-primary bg-primary/10 text-primary-on-tint font-medium'
                    : 'border-border hover:bg-muted',
                )}
              >
                {periodTitle(month)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {orders.length === 0 ? (
        <EmptyState
          illustration="bag"
          title="Sin pedidos este mes"
          description="Cuando alguien pague con la cuenta de empresa, el pedido aparece aquí."
        />
      ) : (
        <>
          <p className="text-sm">
            <span className="text-muted-foreground">Cargado a la cuenta:</span>{' '}
            <span className="font-semibold tabular-nums">
              {formatCOP(charged)}
            </span>
          </p>
          <div className="rounded-card bg-card shadow-1 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  {isAdmin ? <TableHead>Persona</TableHead> : null}
                  <TableHead>Restaurante</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.order_id}>
                    <TableCell>
                      <span className="block font-mono font-semibold">
                        #{order.short_code}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {formatDateCO(order.created_at)}
                      </span>
                    </TableCell>
                    {isAdmin ? (
                      <TableCell>{order.member_name ?? '—'}</TableCell>
                    ) : null}
                    <TableCell>{order.store_name}</TableCell>
                    <TableCell className="text-muted-foreground max-w-48 truncate">
                      {order.corporate_reference ?? '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <OrderStatusBadge status={order.status} />
                        {order.payment_status === 'refunded' ? (
                          <PaymentStatusBadge status={order.payment_status} />
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCOP(Number(order.total))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
