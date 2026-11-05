import type { Metadata } from 'next'
import { PayoutMarkPaidButton } from '@/components/admin/payout-mark-paid-button'
import { PayoutPeriodForm } from '@/components/admin/payout-period-form'
import { StatusBadge } from '@/components/orders/order-status-badge'
import { EmptyState } from '@/components/ui/empty-state'
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
import { PAYOUT_STATUS_LABELS } from '@/lib/payouts/labels'
import { isDebtToPlatform } from '@/lib/payouts/reversal'
import { createClient } from '@/lib/supabase/server'
import { throwOnQueryError } from '@/lib/supabase/query-error'

export const metadata: Metadata = { title: 'Liquidaciones' }
export const dynamic = 'force-dynamic'

export default async function AdminPayoutsPage() {
  await requireRole(['admin'], '/admin/payouts')
  const supabase = await createClient()

  const { data: payouts, error } = await supabase
    .from('payouts')
    .select(
      'id, store_id, period_start, period_end, gross, commission, cash_collected, plan_fee, net, status, paid_at, stores(name, slug)',
    )
    .order('period_start', { ascending: false })
    .limit(200)
  throwOnQueryError(error, 'admin payouts')

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Liquidaciones
        </h1>
        <p className="text-muted-foreground text-sm">
          Genera las liquidaciones del periodo y marca como pagadas las que ya
          se transfirieron. A transferir = ventas − comisión − efectivo que el
          negocio ya cobró − mensualidad del plan; en negativo, la tienda le
          debe a la plataforma. Los reembolsos registrados después de generar un
          periodo se descuentan como ajuste del siguiente. No generes periodos
          que se crucen: un pedido o una mensualidad se cobrarían dos veces.
        </p>
      </header>

      <PayoutPeriodForm />

      {payouts && payouts.length > 0 ? (
        <div className="rounded-card border-border bg-card shadow-soft overflow-x-auto border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tienda</TableHead>
                <TableHead>Periodo</TableHead>
                <TableHead className="text-right">Ventas</TableHead>
                <TableHead className="text-right">Comisión</TableHead>
                <TableHead className="text-right">
                  Efectivo del negocio
                </TableHead>
                <TableHead className="text-right">Plan</TableHead>
                <TableHead className="text-right">A transferir</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((payout) => (
                <TableRow key={payout.id}>
                  <TableCell className="font-medium">
                    {payout.stores?.name ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateCO(new Date(`${payout.period_start}T00:00:00`))}
                    {' – '}
                    {formatDateCO(new Date(`${payout.period_end}T00:00:00`))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCOP(Number(payout.gross))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCOP(Number(payout.commission))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCOP(Number(payout.cash_collected))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCOP(Number(payout.plan_fee))}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCOP(Number(payout.net))}
                    {isDebtToPlatform({ net: Number(payout.net) }) ? (
                      <span className="text-destructive block text-xs font-normal">
                        La tienda debe este saldo
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      label={PAYOUT_STATUS_LABELS[payout.status]}
                      tone={payout.status === 'paid' ? 'success' : 'warning'}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {payout.status === 'pending' ? (
                      <PayoutMarkPaidButton payoutId={payout.id} />
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        {payout.paid_at ? formatDateCO(payout.paid_at) : '—'}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          title="No hay liquidaciones todavía"
          description="Genera la primera liquidación eligiendo un periodo arriba."
        />
      )}
    </div>
  )
}
