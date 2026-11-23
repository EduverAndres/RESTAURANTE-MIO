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
import { payoutDisplayStatus } from '@/lib/payouts/carry'
import { PAYOUT_STATUS_LABELS, PAYOUT_STATUS_TONES } from '@/lib/payouts/labels'
import { createAdminClient } from '@/lib/supabase/admin'
import { throwOnQueryError } from '@/lib/supabase/query-error'

export const metadata: Metadata = { title: 'Liquidaciones de domiciliarios' }
export const dynamic = 'force-dynamic'

const day = (value: string) => formatDateCO(new Date(`${value}T00:00:00`))

/**
 * Courier payouts: what the platform pays each courier per period (delivery
 * fees and tips of online orders), or what the courier still owes (cash
 * collected that was not deposited). Debts carry into the next period.
 */
export default async function AdminCourierPayoutsPage() {
  await requireRole(['admin'], '/admin/domiciliarios/liquidaciones')
  const admin = createAdminClient()
  const [{ data: payouts, error }, { data: couriers, error: couriersError }] =
    await Promise.all([
      admin
        .from('courier_payouts')
        .select(
          'id, courier_id, period_start, period_end, deliveries, earnings, cash_collected, adjustments, carried_in, carried_into_payout_id, net, status, paid_at',
        )
        .order('period_start', { ascending: false })
        .limit(200),
      admin.from('profiles').select('id, full_name').eq('role', 'courier'),
    ])
  throwOnQueryError(error, 'admin courier payouts')
  throwOnQueryError(couriersError, 'admin courier names')
  const names = new Map(
    (couriers ?? []).map((courier) => [courier.id, courier.full_name]),
  )

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-h1 font-display font-semibold">
          Liquidaciones de domiciliarios
        </h1>
        <p className="text-muted-foreground text-sm text-pretty">
          Neto = domicilios y propinas ganados − efectivo cobrado +
          consignaciones y ajustes + saldo anterior. En positivo, Cerquita le
          paga al domiciliario; en negativo, el domiciliario debe y se descuenta
          de su siguiente liquidación. Las consignaciones se registran en
          Domiciliarios.
        </p>
      </header>

      <PayoutPeriodForm target="couriers" />

      {payouts && payouts.length > 0 ? (
        <div className="rounded-card bg-card shadow-1 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domiciliario</TableHead>
                <TableHead>Periodo</TableHead>
                <TableHead className="text-right">Entregas</TableHead>
                <TableHead className="text-right">Ganado</TableHead>
                <TableHead className="text-right">Efectivo cobrado</TableHead>
                <TableHead className="text-right">
                  Consignaciones y ajustes
                </TableHead>
                <TableHead className="text-right">Saldo anterior</TableHead>
                <TableHead className="text-right">Neto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((payout) => {
                const status = payoutDisplayStatus(payout)
                const net = Number(payout.net)
                return (
                  <TableRow key={payout.id}>
                    <TableCell className="font-medium">
                      {names.get(payout.courier_id)?.trim() || 'Domiciliario'}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {day(payout.period_start)} – {day(payout.period_end)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {payout.deliveries}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCOP(Number(payout.earnings))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCOP(Number(payout.cash_collected))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCOP(Number(payout.adjustments))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCOP(Number(payout.carried_in))}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCOP(net)}
                      {status === 'pending' && net < 0 ? (
                        <span className="text-destructive block text-xs font-normal">
                          El domiciliario debe este saldo
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={PAYOUT_STATUS_LABELS[status]}
                        tone={PAYOUT_STATUS_TONES[status]}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {status === 'pending' ? (
                        <PayoutMarkPaidButton
                          payoutId={payout.id}
                          target="couriers"
                        />
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
          title="No hay liquidaciones de domiciliarios todavía"
          description="Genera la primera eligiendo un periodo arriba."
        />
      )}
    </div>
  )
}
