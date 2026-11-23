import { BanknoteIcon, WalletIcon } from 'lucide-react'
import type { Metadata } from 'next'
import { StatusBadge } from '@/components/orders/order-status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { requireRole } from '@/lib/auth'
import { formatCOP } from '@/lib/format'
import { formatDateCO } from '@/lib/format-date'
import { payoutDisplayStatus } from '@/lib/payouts/carry'
import { PAYOUT_STATUS_LABELS, PAYOUT_STATUS_TONES } from '@/lib/payouts/labels'
import { createClient } from '@/lib/supabase/server'
import { throwOnQueryError } from '@/lib/supabase/query-error'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Mis ganancias' }
export const dynamic = 'force-dynamic'

const ENTRY_LIMIT = 30

const KIND_LABELS = {
  delivery: 'Entrega',
  deposit: 'Consignación',
  adjustment: 'Ajuste',
} as const

const day = (value: string) => formatDateCO(new Date(`${value}T00:00:00`))

/**
 * What a courier has earned and what they owe. Earnings are the delivery fee
 * and the whole tip of every delivery; on a cash order the courier also holds
 * money that is not theirs, which they deposit. Settled per period.
 */
export default async function CourierEarningsPage() {
  const { user } = await requireRole(['courier', 'admin'], '/courier/ganancias')
  const supabase = await createClient()

  const [
    { data: status, error: statusError },
    { data: entries, error: entriesError },
    { data: payouts, error: payoutsError },
  ] = await Promise.all([
    supabase.rpc('my_courier_cash_status'),
    supabase
      .from('courier_ledger')
      .select(
        'id, kind, earnings, cash_collected, amount, note, occurred_at, settled_in_payout_id, orders(short_code)',
      )
      .eq('courier_id', user.id)
      .order('occurred_at', { ascending: false })
      .limit(ENTRY_LIMIT),
    supabase
      .from('courier_payouts')
      .select(
        'id, period_start, period_end, deliveries, earnings, cash_collected, adjustments, carried_in, carried_into_payout_id, net, status, paid_at',
      )
      .eq('courier_id', user.id)
      .order('period_start', { ascending: false })
      .limit(24),
  ])
  throwOnQueryError(statusError, 'courier cash status')
  throwOnQueryError(entriesError, 'courier ledger')
  throwOnQueryError(payoutsError, 'courier payouts')

  const cash = (Array.isArray(status) ? status[0] : status) ?? {
    balance: 0,
    in_progress: 0,
    exposure: 0,
    cap: 0,
    blocked: false,
  }
  const balance = Number(cash.balance)
  const exposure = Math.max(0, Number(cash.exposure))
  const cap = Number(cash.cap)
  const usedPct =
    cap > 0 ? Math.min(100, Math.round((exposure / cap) * 100)) : 0

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Mis ganancias
        </h1>
        <p className="text-muted-foreground text-sm text-pretty">
          Ganas el valor del domicilio y el 100 % de la propina de cada entrega.
          En los pedidos en efectivo cobras el total: lo que no es tuyo lo
          consignas. Cerquita liquida cada periodo.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <section
          aria-labelledby="saldo-title"
          className="rounded-card bg-card shadow-1 p-card space-y-2"
        >
          <h2
            id="saldo-title"
            className="text-muted-foreground flex items-center gap-2 text-sm font-medium"
          >
            <WalletIcon aria-hidden="true" className="size-4" />
            Saldo con Cerquita
          </h2>
          <p
            className={cn(
              'font-display text-3xl font-semibold tabular-nums',
              balance < 0 && 'text-destructive',
            )}
          >
            {formatCOP(Math.abs(balance))}
          </p>
          <p className="text-muted-foreground text-sm">
            {balance > 0
              ? 'Cerquita te debe este valor. Te llega en la próxima liquidación.'
              : balance < 0
                ? 'Debes consignar este valor de efectivo cobrado.'
                : 'Estás al día.'}
          </p>
        </section>

        <section
          aria-labelledby="efectivo-title"
          className="rounded-card bg-card shadow-1 p-card space-y-3"
        >
          <h2
            id="efectivo-title"
            className="text-muted-foreground flex items-center gap-2 text-sm font-medium"
          >
            <BanknoteIcon aria-hidden="true" className="size-4" />
            Efectivo por consignar
          </h2>
          <p className="font-display text-3xl font-semibold tabular-nums">
            {formatCOP(exposure)}
            <span className="text-muted-foreground text-base font-normal">
              {' '}
              de {formatCOP(cap)}
            </span>
          </p>
          <div
            role="meter"
            aria-label="Efectivo por consignar frente al tope"
            aria-valuemin={0}
            aria-valuemax={cap}
            aria-valuenow={exposure}
            className="bg-muted h-2.5 overflow-hidden rounded-full"
          >
            <div
              className={cn(
                'h-full rounded-full',
                cash.blocked ? 'bg-destructive' : 'bg-primary',
              )}
              style={{ width: `${usedPct}%` }}
            />
          </div>
          <p className="text-muted-foreground text-sm">
            {cash.blocked
              ? 'Llegaste al tope: consigna para volver a tomar pedidos en efectivo. Los pagados en línea sí los puedes tomar.'
              : 'Incluye los pedidos en efectivo que llevas ahora. Al llegar al tope solo podrás tomar pedidos pagados en línea.'}
          </p>
        </section>
      </div>

      <section aria-labelledby="movimientos-title" className="space-y-3">
        <h2
          id="movimientos-title"
          className="font-display text-xl font-semibold"
        >
          Movimientos
        </h2>
        {entries && entries.length > 0 ? (
          <ul className="rounded-card bg-card shadow-1 divide-border divide-y">
            {entries.map((entry) => {
              const net =
                Number(entry.earnings) -
                Number(entry.cash_collected) +
                Number(entry.amount)
              return (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {KIND_LABELS[entry.kind as keyof typeof KIND_LABELS] ??
                        'Movimiento'}
                      {entry.orders?.short_code
                        ? ` · #${entry.orders.short_code}`
                        : ''}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatDateCO(entry.occurred_at)}
                      {Number(entry.cash_collected) > 0
                        ? ` · cobraste ${formatCOP(Number(entry.cash_collected))} en efectivo`
                        : ''}
                      {Number(entry.earnings) > 0
                        ? ` · ganaste ${formatCOP(Number(entry.earnings))}`
                        : ''}
                      {entry.note ? ` · ${entry.note}` : ''}
                      {entry.settled_in_payout_id ? ' · liquidado' : ''}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'font-medium tabular-nums',
                      net < 0 && 'text-destructive',
                    )}
                  >
                    {net < 0 ? '−' : '+'}
                    {formatCOP(Math.abs(net))}
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState
            title="Todavía no tienes movimientos"
            description="Cada entrega que completes aparecerá aquí con lo que ganaste."
          />
        )}
      </section>

      {payouts && payouts.length > 0 ? (
        <section aria-labelledby="liquidaciones-title" className="space-y-3">
          <h2
            id="liquidaciones-title"
            className="font-display text-xl font-semibold"
          >
            Liquidaciones
          </h2>
          <ul className="rounded-card bg-card shadow-1 divide-border divide-y">
            {payouts.map((payout) => {
              const status = payoutDisplayStatus(payout)
              const net = Number(payout.net)
              return (
                <li
                  key={payout.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {day(payout.period_start)} – {day(payout.period_end)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {payout.deliveries} entrega
                      {payout.deliveries === 1 ? '' : 's'} · ganaste{' '}
                      {formatCOP(Number(payout.earnings))}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'font-medium tabular-nums',
                        net < 0 && 'text-destructive',
                      )}
                    >
                      {net < 0
                        ? `Debías ${formatCOP(-net)}`
                        : `Te pagamos ${formatCOP(net)}`}
                    </span>
                    <StatusBadge
                      label={PAYOUT_STATUS_LABELS[status]}
                      tone={PAYOUT_STATUS_TONES[status]}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
