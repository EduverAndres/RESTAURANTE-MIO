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
import { openDebtByStore, payoutDisplayStatus } from '@/lib/payouts/carry'
import { PAYOUT_STATUS_LABELS, PAYOUT_STATUS_TONES } from '@/lib/payouts/labels'
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
        'id, store_id, period_start, period_end, gross, commission, cash_collected, plan_fee, ads_fee, delivery_and_tips, carried_in, carried_into_payout_id, net, status, paid_at',
      )
      .eq('store_id', store.id)
      .order('period_start', { ascending: false })
      .limit(100),
    fetchPlanFees(supabase),
  ])
  throwOnQueryError(error, 'merchant payouts')
  const openDebt =
    openDebtByStore(
      (payouts ?? []).map((payout) => ({ ...payout, net: Number(payout.net) })),
    ).get(store.id) ?? 0

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Plan y liquidaciones
        </h1>
        <p className="text-muted-foreground text-sm text-pretty">
          Lo que te transferimos por periodo: tus ventas, menos la comisión,
          menos lo que ya cobraste en efectivo (eso ya está en tu caja), la
          mensualidad de tu plan y los días de publicidad que estuvieron al
          aire. Si tú mismo entregas o despachas un pedido pagado en línea, el
          domicilio y la propina también son tuyos y te llegan aquí; si lo lleva
          un domiciliario de Cerquita, son para él. Si vendes sobre todo en
          efectivo, el periodo puede salir en negativo: es lo que le debes a la
          plataforma, y se descuenta de tu siguiente liquidación.
        </p>
        {openDebt > 0 ? (
          <p className="text-destructive text-sm font-medium">
            Saldo pendiente con Cerquita: {formatCOP(openDebt)}. Se descontará
            de tu próxima liquidación.
          </p>
        ) : null}
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
                <TableHead className="text-right">Publicidad</TableHead>
                <TableHead className="text-right">
                  Domicilios y propinas
                </TableHead>
                <TableHead className="text-right">Saldo anterior</TableHead>
                <TableHead className="text-right">Te transferimos</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((payout) => {
                const status = payoutDisplayStatus(payout)
                return (
                  <TableRow key={payout.id}>
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
                      {formatCOP(Number(payout.ads_fee))}
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
                          Le debes a la plataforma
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={PAYOUT_STATUS_LABELS[status]}
                        tone={PAYOUT_STATUS_TONES[status]}
                      />
                      {status === 'carried' ? (
                        <span className="text-muted-foreground mt-1 block text-xs">
                          Se descontó en una liquidación posterior
                        </span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                )
              })}
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
