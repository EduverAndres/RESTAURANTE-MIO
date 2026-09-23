'use client'

import { useId, useState } from 'react'
import {
  BREAK_EVEN_UNREACHABLE,
  compareChannelCost,
} from '@/lib/marketing/channel-cost'
import { formatCOP } from '@/lib/format'

/**
 * The whole sales argument, as one number the merchant recognises.
 *
 * Both inputs are theirs: what they sell and what they are charged. Nothing
 * here asserts a competitor's rate, and the result is allowed to come out
 * negative — a small restaurant gets an honest "not yet" and the number stays
 * believable for the one it does suit.
 */

const SUBSCRIPTION = 149_000

export function SavingsCalculator() {
  const revenueId = useId()
  const rateId = useId()
  const [revenue, setRevenue] = useState(10_000_000)
  const [rate, setRate] = useState(25)

  const result = compareChannelCost({
    monthlyRevenue: revenue,
    commissionPct: rate,
    subscription: SUBSCRIPTION,
  })

  return (
    <div className="bg-card rounded-card border-border/60 border p-card shadow-[var(--shadow-2)]">
      <div className="grid gap-card sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor={revenueId} className="text-small font-medium">
            ¿Cuánto vendés al mes por la app?
          </label>
          <input
            id={revenueId}
            type="range"
            min={0}
            max={60_000_000}
            step={500_000}
            value={revenue}
            onChange={(event) => setRevenue(Number(event.target.value))}
            className="accent-primary w-full"
          />
          <p className="text-h3 font-display tabular-nums">
            {formatCOP(revenue)}
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor={rateId} className="text-small font-medium">
            ¿Qué comisión te cobran?
          </label>
          <input
            id={rateId}
            type="range"
            min={0}
            max={40}
            step={1}
            value={rate}
            onChange={(event) => setRate(Number(event.target.value))}
            className="accent-primary w-full"
          />
          <p className="text-h3 font-display tabular-nums">{rate}%</p>
        </div>
      </div>

      <dl className="mt-6 grid gap-4 sm:grid-cols-3" aria-live="polite">
        <div>
          <dt className="text-muted-foreground text-small">
            Comisión que pagás hoy
          </dt>
          <dd className="text-h3 font-display tabular-nums">
            {formatCOP(result.marketplaceCost)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-small">Tu propio canal</dt>
          <dd className="text-h3 font-display tabular-nums">
            {formatCOP(result.ourCost)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-small">
            {result.worthIt ? 'Te queda a vos' : 'Diferencia'}
          </dt>
          <dd
            className={`text-h3 font-display tabular-nums ${
              result.worthIt ? 'text-[var(--success-on-tint)]' : ''
            }`}
          >
            {formatCOP(Math.abs(result.monthlySaving))}
          </dd>
        </div>
      </dl>

      <p className="text-muted-foreground mt-5 text-small">
        {result.worthIt ? (
          <>
            Son <strong>{formatCOP(result.yearlySaving)}</strong> al año que
            dejan de irse en comisiones.
          </>
        ) : result.breakEvenRevenue === BREAK_EVEN_UNREACHABLE ? (
          <>
            Si no te cobran comisión, quedate donde estás. Volvé el día que
            empiecen a cobrarte.
          </>
        ) : (
          <>
            Todavía no te conviene, y preferimos decírtelo: la cuenta empieza a
            darte a partir de{' '}
            <strong>{formatCOP(result.breakEvenRevenue)}</strong> al mes.
          </>
        )}
      </p>
    </div>
  )
}
