'use client'

import { useId, useState } from 'react'
import { formatCOP } from '@/lib/format'
import { compareChannelCost } from '@/lib/marketing/channel-cost'
import { BASE_COMMISSION_PCT, ONLINE_PAYMENT_PCT } from '@/lib/plans'

/**
 * The whole sales argument, as one number the merchant recognises.
 *
 * The inputs are theirs: what they sell through their current app, what that
 * app charges, and how much of it is paid online. Nothing here asserts a
 * competitor's rate. Our side is the Normal plan exactly as it is charged
 * (lib/plans.ts), so the result is allowed to come out negative.
 */
export function SavingsCalculator() {
  const revenueId = useId()
  const rateId = useId()
  const onlineId = useId()
  const [revenue, setRevenue] = useState(10_000_000)
  const [rate, setRate] = useState(25)
  const [online, setOnline] = useState(50)

  const result = compareChannelCost({
    monthlyRevenue: revenue,
    commissionPct: rate,
    onlineSharePct: online,
    ourCommissionPct: BASE_COMMISSION_PCT,
    ourOnlinePct: ONLINE_PAYMENT_PCT,
    ourMonthlyFee: 0,
  })

  return (
    <div className="bg-card rounded-card border-border/60 p-card border shadow-[var(--shadow-2)]">
      <div className="gap-card grid sm:grid-cols-3">
        <div className="space-y-2">
          <label htmlFor={revenueId} className="text-small font-medium">
            ¿Cuánto vendes al mes por apps de domicilio?
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
          <p className="text-h3 font-display tabular-nums">{rate} %</p>
        </div>

        <div className="space-y-2">
          <label htmlFor={onlineId} className="text-small font-medium">
            ¿Cuánto te pagan en línea?
          </label>
          <input
            id={onlineId}
            type="range"
            min={0}
            max={100}
            step={10}
            value={online}
            onChange={(event) => setOnline(Number(event.target.value))}
            className="accent-primary w-full"
          />
          <p className="text-h3 font-display tabular-nums">{online} %</p>
        </div>
      </div>

      <dl className="mt-6 grid gap-4 sm:grid-cols-3" aria-live="polite">
        <div>
          <dt className="text-muted-foreground text-small">
            Comisión que pagas hoy
          </dt>
          <dd className="text-h3 font-display tabular-nums">
            {formatCOP(result.marketplaceCost)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-small">
            Con Cerquita ({result.ourEffectivePct.toLocaleString('es-CO')} %)
          </dt>
          <dd className="text-h3 font-display tabular-nums">
            {formatCOP(result.ourCost)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-small">
            {result.worthIt ? 'Te ahorras' : 'Diferencia'}
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

      <p className="text-muted-foreground text-small mt-5">
        {result.worthIt ? (
          <>
            Son <strong>{formatCOP(result.yearlySaving)}</strong> al año que
            dejan de irse en comisiones.
          </>
        ) : (
          <>
            Con estos números tu app de hoy te sale igual o más barata, y
            preferimos decírtelo.
          </>
        )}{' '}
        Calculado con el plan Normal: sin mensualidad, {BASE_COMMISSION_PCT} %
        en domicilio y para recoger, y {ONLINE_PAYMENT_PCT} % más en lo que te
        paguen en línea. En la mesa no cobramos comisión.
      </p>
    </div>
  )
}
