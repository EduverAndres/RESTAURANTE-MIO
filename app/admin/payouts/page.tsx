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
import { openDebtByStore, payoutDisplayStatus } from '@/lib/payouts/carry'
import { PAYOUT_STATUS_LABELS, PAYOUT_STATUS_TONES } from '@/lib/payouts/labels'
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
      'id, store_id, period_start, period_end, gross, commission, cash_collected, plan_fee, delivery_and_tips, carried_in, carried_into_payout_id, net, status, paid_at, stores(name, slug)',
    )
    .order('period_start', { ascending: false })
    .limit(200)
  throwOnQueryError(error, 'admin payouts')
  const openDebt = [
    ...openDebtByStore(
      (payouts ?? []).map((payout) => ({ ...payout, net: Number(payout.net) })),
    ).values(),
  ].reduce((sum, debt) => sum + debt, 0)
  // Where a carried debt went, read from the rows already loaded.
  const periodStartById = new Map(
    (payouts ?? []).map((payout) => [payout.id, payout.period_start]),
  )

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Liquidaciones
        </h1>
        <p className="text-muted-foreground text-sm">
          Genera las liquidaciones del periodo y marca como pagadas las que ya
          se transfirieron. A transferir = ventas − comisión − efectivo que el
          negocio ya cobró − mensualidad del plan + domicilios y propinas que el
          negocio entregó y se pagaron en línea + saldo anterior. En negativo,
          la tienda le debe a la plataforma, y esa deuda se descuenta sola de su
          siguiente liquidación (queda «Arrastrada»). Los reembolsos registrados
          después de generar un periodo se descuentan como ajuste del siguiente.
          No generes periodos que se crucen: un pedido o una mensualidad se
          cobrarían dos veces.
        </p>
        {openDebt > 0 ? (
          <p className="text-destructive text-sm font-medium">
            Deuda abierta de las tiendas: {formatCOP(openDebt)}. Se descontará
            de sus próximas liquidaciones.
          </p>
        ) : null}
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
                <TableHead className="text-right">
                  Domicilios y propinas
                </TableHead>
                <TableHead className="text-right">Saldo anterior</TableHead>
                <TableHead className="text-right">A transferir</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((payout) => {
                const status = payoutDisplayStatus(payout)
                return (
                  <TableRow key={payout.id}>
                    <TableCell className="font-medium">
                      {payout.stores?.name ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateCO(
                        new Date(`${payout.period_start}T00:00:00`),
                      )}
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
                    <TableCell className="text-right tabular-nums">
                      {formatCOP(Number(payout.delivery_and_tips))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCOP(Number(payout.carried_in))}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCOP(Number(payout.net))}
                      {status === 'pending' &&
                      isDebtToPlatform({ net: Number(payout.net) }) ? (
                        <span className="text-destructive block text-xs font-normal">
                          La tienda debe este saldo
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={PAYOUT_STATUS_LABELS[status]}
                        tone={PAYOUT_STATUS_TONES[status]}
                      />
                      {payout.carried_into_payout_id &&
                      periodStartById.has(payout.carried_into_payout_id) ? (
                        <span className="text-muted-foreground mt-1 block text-xs">
                          al periodo{' '}
                          {formatDateCO(
                            new Date(
                              `${periodStartById.get(payout.carried_into_payout_id)}T00:00:00`,
                            ),
                          )}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      {status === 'pending' ? (
                        <PayoutMarkPaidButton payoutId={payout.id} />
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          {payout.paid_at ? formatDateCO(payout.paid_at) : '—'}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
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
