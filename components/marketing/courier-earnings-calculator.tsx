'use client'

import { InfoIcon } from 'lucide-react'
import { useState } from 'react'
import { RangeSlider as Slider } from '@/components/marketing/range-slider'
import { CountUp } from '@/components/motion/count-up'
import { formatCOP } from '@/lib/format'
import {
  COURIER_ESTIMATE_RANGES,
  estimateCourierEarnings,
  type CourierEarningsInput,
} from '@/lib/marketing/courier-earnings'

/**
 * The courier's estimate, with their own numbers.
 *
 * The arithmetic is `lib/marketing/courier-earnings.ts` (tested); this only
 * holds the four inputs. The result says, next to the figure and in plain
 * words, that it is an estimate and not a guaranteed income, and what it
 * leaves out. The total counts to its new value as a slider moves (CountUp,
 * instant with reduced motion); the live region reads only the final value.
 */
export function CourierEarningsCalculator({
  initial,
  usesRealAverage,
}: {
  initial: CourierEarningsInput
  /** True when the starting fee is the average of the live stores. */
  usesRealAverage: boolean
}) {
  const [input, setInput] = useState(initial)
  const result = estimateCourierEarnings(input)
  const ranges = COURIER_ESTIMATE_RANGES

  function update(key: keyof CourierEarningsInput) {
    return (value: number) =>
      setInput((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="rounded-card bg-card shadow-2 p-card grid gap-8 lg:grid-cols-2 lg:gap-12">
      <div className="space-y-5">
        <Slider
          label="Entregas por día"
          value={input.deliveriesPerDay}
          {...ranges.deliveriesPerDay}
          display={String(input.deliveriesPerDay)}
          onChange={update('deliveriesPerDay')}
        />
        <Slider
          label="Valor promedio del domicilio"
          value={input.averageFee}
          {...ranges.averageFee}
          display={formatCOP(input.averageFee)}
          onChange={update('averageFee')}
        />
        <Slider
          label="Propina promedio por entrega"
          value={input.averageTip}
          {...ranges.averageTip}
          display={formatCOP(input.averageTip)}
          onChange={update('averageTip')}
        />
        <Slider
          label="Días que trabajas"
          value={input.days}
          {...ranges.days}
          display={`${input.days} ${input.days === 1 ? 'día' : 'días'}`}
          onChange={update('days')}
        />
        <p className="text-muted-foreground text-xs text-pretty">
          {usesRealAverage
            ? 'El domicilio de partida es el promedio de los negocios activos hoy. Mueve los valores a tu caso.'
            : 'Los valores de partida son solo un ejemplo. Mueve los valores a tu caso.'}
        </p>
      </div>

      <div className="flex flex-col gap-5">
        <div aria-live="polite" className="space-y-1">
          <p className="text-muted-foreground text-sm">
            Podrías ganar en {input.days} {input.days === 1 ? 'día' : 'días'}
          </p>
          <p className="text-display font-display font-semibold">
            <CountUp value={result.total} format="cop" />
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Por entrega</dt>
            <dd className="font-display text-lg font-semibold tabular-nums">
              {formatCOP(result.perDelivery)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Por día</dt>
            <dd className="font-display text-lg font-semibold tabular-nums">
              {formatCOP(result.perDay)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">De domicilios</dt>
            <dd className="font-display text-lg font-semibold tabular-nums">
              {formatCOP(result.fromFees)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">De propinas (100 %)</dt>
            <dd className="font-display text-lg font-semibold tabular-nums">
              {formatCOP(result.fromTips)}
            </dd>
          </div>
        </dl>

        <div className="rounded-control bg-accent/15 mt-auto flex gap-3 p-4 text-sm">
          <InfoIcon
            aria-hidden="true"
            className="text-accent-strong mt-0.5 size-5 shrink-0"
          />
          <div className="space-y-1">
            <p className="font-semibold">
              Es una estimación, no una garantía de ingresos.
            </p>
            <p className="text-foreground/80 text-pretty">
              Lo que ganes depende de los pedidos que haya y de los que aceptes.
              No descuenta tus gastos (gasolina, mantenimiento, plan de datos)
              ni tus aportes a seguridad social.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
