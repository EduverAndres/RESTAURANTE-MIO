'use client'

import { InfoIcon } from 'lucide-react'
import { useState } from 'react'
import { RangeSlider } from '@/components/marketing/range-slider'
import { CountUp } from '@/components/motion/count-up'
import {
  COMPANY_ESTIMATE_DEFAULTS,
  COMPANY_ESTIMATE_RANGES,
  estimateCompanyBudget,
  type CompanyEstimateInput,
} from '@/lib/companies/calculator'
import { PAYMENT_TERMS_OPTIONS } from '@/lib/companies/vocabulary'
import { formatCOP } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * What the team's orders could cost a month and the credit line that would
 * cover them, with the company's own numbers. The arithmetic is
 * lib/companies/calculator.ts (tested); the result says, next to the figure,
 * that it is an estimate and that the credit line is approved by Cerquita.
 */
export function CompanyBudgetCalculator() {
  const [input, setInput] = useState<CompanyEstimateInput>(
    COMPANY_ESTIMATE_DEFAULTS,
  )
  const result = estimateCompanyBudget(input)
  const ranges = COMPANY_ESTIMATE_RANGES

  function update(key: keyof CompanyEstimateInput) {
    return (value: number) =>
      setInput((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="rounded-card bg-card shadow-2 p-card grid gap-8 lg:grid-cols-2 lg:gap-12">
      <div className="space-y-5">
        <RangeSlider
          label="Personas en tu equipo"
          value={input.employees}
          {...ranges.employees}
          display={String(input.employees)}
          onChange={update('employees')}
        />
        <RangeSlider
          label="Pedidos por persona a la semana"
          value={input.ordersPerWeek}
          {...ranges.ordersPerWeek}
          display={String(input.ordersPerWeek)}
          onChange={update('ordersPerWeek')}
        />
        <RangeSlider
          label="Valor promedio por pedido"
          value={input.averageTicket}
          {...ranges.averageTicket}
          display={formatCOP(input.averageTicket)}
          onChange={update('averageTicket')}
        />
        <fieldset className="space-y-2">
          <legend className="text-small font-medium">Plazo de pago</legend>
          <div role="radiogroup" className="grid grid-cols-4 gap-2">
            {PAYMENT_TERMS_OPTIONS.map((days) => (
              <button
                key={days}
                type="button"
                role="radio"
                aria-checked={input.termsDays === days}
                onClick={() => update('termsDays')(days)}
                className={cn(
                  'rounded-control border-border h-11 border text-sm font-medium tabular-nums transition-colors',
                  input.termsDays === days
                    ? 'border-primary bg-primary/10 text-primary-on-tint'
                    : 'hover:bg-muted',
                )}
              >
                {days} días
              </button>
            ))}
          </div>
        </fieldset>
        <p className="text-muted-foreground text-xs text-pretty">
          Los valores de partida son solo un ejemplo. El valor por pedido
          incluye domicilio y propina.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        <div aria-live="polite" className="space-y-1">
          <p className="text-muted-foreground text-sm">
            Tu equipo gastaría al mes, aproximadamente
          </p>
          <p className="text-display font-display font-semibold">
            <CountUp value={result.monthly} format="cop" />
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Pedidos al mes</dt>
            <dd className="font-display text-lg font-semibold tabular-nums">
              {result.ordersPerMonth}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Presupuesto por persona</dt>
            <dd className="font-display text-lg font-semibold tabular-nums">
              {formatCOP(result.perEmployee)}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground">
              Cupo que cubriría el mes y el plazo de pago
            </dt>
            <dd className="font-display text-lg font-semibold tabular-nums">
              {formatCOP(result.suggestedCredit)}
            </dd>
          </div>
        </dl>

        <div className="rounded-control bg-accent/15 mt-auto flex gap-3 p-4 text-sm">
          <InfoIcon
            aria-hidden="true"
            className="text-accent-strong mt-0.5 size-5 shrink-0"
          />
          <div className="space-y-1">
            <p className="font-semibold">Es una estimación, no una oferta.</p>
            <p className="text-foreground/80 text-pretty">
              El cupo y el plazo los aprueba el equipo de Cerquita al revisar tu
              empresa. Pagas solo lo que tu equipo pida.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
