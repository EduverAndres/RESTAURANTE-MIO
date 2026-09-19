import type { Metadata } from 'next'
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
import { requireActiveStoreRow } from '@/lib/dashboard/store-context'
import { formatCOP } from '@/lib/format'
import { formatDateCO } from '@/lib/format-date'
import { PAYOUT_STATUS_LABELS } from '@/lib/payouts/labels'
import { isDebtToPlatform } from '@/lib/payouts/reversal'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Liquidaciones' }
export const dynamic = 'force-dynamic'

export default async function DashboardPayoutsPage() {
  const { store } = await requireActiveStoreRow('/dashboard/payouts')
  const supabase = await createClient()

  const { data: payouts } = await supabase
    .from('payouts')
    .select('id, period_start, period_end, gross, commission, net, status, paid_at')
    .eq('store_id', store.id)
    .order('period_start', { ascending: false })
    .limit(100)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Liquidaciones
        </h1>
        <p className="text-muted-foreground text-sm">
          Lo que {store.name} recibe por periodo, después de la comisión de
          la plataforma. El domicilio y la propina no hacen parte de la
          liquidación: se pagan aparte al domiciliario. Un reembolso que
          registres después de generado un periodo se descuenta del
          siguiente, así que ese periodo puede salir en negativo.
        </p>
      </header>

      {payouts && payouts.length > 0 ? (
        <div className="rounded-card border-border bg-card shadow-soft overflow-x-auto border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Periodo</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Comisión</TableHead>
                <TableHead className="text-right">Neto</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((payout) => (
                <TableRow key={payout.id}>
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
                    {isDebtToPlatform({ net: Number(payout.net) }) ? (
                      <span className="text-destructive block text-xs font-normal">
                        Saldo a favor de la plataforma
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      label={PAYOUT_STATUS_LABELS[payout.status]}
                      tone={payout.status === 'paid' ? 'success' : 'warning'}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          title="Todavía no hay liquidaciones"
          description="Aparecerán aquí después de que un administrador genere la del periodo."
        />
      )}
    </div>
  )
}
