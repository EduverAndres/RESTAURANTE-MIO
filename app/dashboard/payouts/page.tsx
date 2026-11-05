import type { Metadata } from 'next'
import { PlanCard } from '@/components/dashboard/plan/plan-card'
import { StatusBadge } from '@/components/orders/order-status-badge'
import { WompiTrust } from '@/components/payments/wompi-trust'
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
import { fetchPlanFees } from '@/lib/plans-server'
import { createClient } from '@/lib/supabase/server'
import { throwOnQueryError } from '@/lib/supabase/query-error'

export const metadata: Metadata = { title: 'Plan y liquidaciones' }
export const dynamic = 'force-dynamic'

export default async function DashboardPayoutsPage() {
  const { store } = await requireActiveStoreRow('/dashboard/payouts')
  const supabase = await createClient()

  const [{ data: payouts, error }, fees] = await Promise.all([
    supabase
      .from('payouts')
      .select(
        'id, period_start, period_end, gross, commission, cash_collected, plan_fee, net, status, paid_at',
      )
      .eq('store_id', store.id)
      .order('period_start', { ascending: false })
      .limit(100),
    fetchPlanFees(supabase),
  ])
  throwOnQueryError(error, 'merchant payouts')

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Plan y liquidaciones
        </h1>
        <p className="text-muted-foreground text-sm text-pretty">
          Lo que te transferimos por periodo: tus ventas, menos la comisión,
          menos lo que ya cobraste en efectivo (eso ya está en tu caja) y la
          mensualidad de tu plan. El domicilio y la propina no hacen parte de la
          liquidación: se pagan aparte al domiciliario. Si vendes sobre todo en
          efectivo, o registras un reembolso de un periodo ya generado, el
          periodo puede salir en negativo: es lo que le debes a la plataforma.
        </p>
        <WompiTrust compact className="pt-1" />
      </header>

      <PlanCard store={store} fees={fees} />

      {payouts && payouts.length > 0 ? (
        <div className="rounded-card border-border bg-card shadow-soft overflow-x-auto border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Periodo</TableHead>
                <TableHead className="text-right">Ventas</TableHead>
                <TableHead className="text-right">Comisión</TableHead>
                <TableHead className="text-right">
                  Ya cobraste en efectivo
                </TableHead>
                <TableHead className="text-right">Plan</TableHead>
                <TableHead className="text-right">Te transferimos</TableHead>
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
                        Le debes a la plataforma
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
