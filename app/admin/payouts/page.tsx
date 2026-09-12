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
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Liquidaciones' }
export const dynamic = 'force-dynamic'

export default async function AdminPayoutsPage() {
  await requireRole(['admin'], '/admin/payouts')
  const supabase = await createClient()

  const { data: payouts } = await supabase
    .from('payouts')
    .select('id, store_id, period_start, period_end, gross, commission, net, status, paid_at, stores(name, slug)')
    .order('period_start', { ascending: false })
    .limit(200)

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Liquidaciones
        </h1>
        <p className="text-muted-foreground text-sm">
          Genera las liquidaciones del periodo y marca como pagadas las que
          ya se transfirieron.
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
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Comisión</TableHead>
                <TableHead className="text-right">Neto</TableHead>
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
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCOP(Number(payout.net))}
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
                        {payout.paid_at
                          ? formatDateCO(payout.paid_at)
                          : '—'}
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
