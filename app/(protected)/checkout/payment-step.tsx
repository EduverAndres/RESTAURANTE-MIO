'use client'

import { ChevronLeftIcon } from 'lucide-react'
import { OptionCard } from './option-card'
import { PaymentMark } from './payment-mark'
import type { CheckoutController } from './use-checkout'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatCOP } from '@/lib/format'
import { TIP_PRESETS, computeTip } from '@/lib/pricing'
import { cn } from '@/lib/utils'

function TipSelector({ checkout }: { checkout: CheckoutController }) {
  const beneficiary =
    checkout.type === 'delivery' ? 'el domiciliario' : 'el equipo'

  return (
    <div className="space-y-2">
      <Label id="checkout-tip-label" className="text-sm font-semibold">
        Propina para {beneficiary}
      </Label>
      {/*
        Big targets, and each one shows the money rather than the maths. A
        percentage is a puzzle to solve at the till; "$2.400" is a decision.
      */}
      <div
        role="radiogroup"
        aria-labelledby="checkout-tip-label"
        className="grid grid-cols-4 gap-2"
      >
        {TIP_PRESETS.map((preset) => {
          const active = checkout.tipPercent === preset
          const amount = computeTip(checkout.totals.subtotal, {
            kind: 'percent',
            value: preset,
          })
          return (
            <button
              key={preset}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => checkout.setTipPercent(preset)}
              className={cn(
                'rounded-card flex h-20 flex-col items-center justify-center gap-0.5 border text-center transition-colors',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted',
              )}
            >
              <span className="font-display text-xl font-semibold">
                {preset === 0 ? '—' : `${preset} %`}
              </span>
              <span
                className={cn(
                  'text-xs tabular-nums',
                  active
                    ? 'text-primary-foreground/80'
                    : 'text-muted-foreground',
                )}
              >
                {preset === 0 ? 'Sin propina' : formatCOP(amount)}
              </span>
            </button>
          )
        })}
      </div>
      {checkout.tip > 0 ? (
        <p className="text-muted-foreground text-xs">
          Agregas {formatCOP(checkout.tip)}. Va íntegra a {beneficiary}.
        </p>
      ) : null}
    </div>
  )
}

export function PaymentStep({
  checkout,
  className,
}: {
  checkout: CheckoutController
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-card border-border bg-card shadow-1 p-card space-y-5 border',
        className,
      )}
      aria-labelledby="pago-title"
    >
      <h2 id="pago-title" className="text-h3 font-display font-semibold">
        Pago
      </h2>

      <div role="radiogroup" aria-label="Método de pago" className="grid gap-2">
        {checkout.paymentOptions.map((option) => (
          <OptionCard
            key={option.method}
            checked={checkout.paymentMethod === option.method}
            onSelect={() => checkout.setPaymentMethod(option.method)}
            leading={<PaymentMark method={option.method} />}
            title={option.label}
            hint={option.description}
          />
        ))}
      </div>

      <TipSelector checkout={checkout} />

      <div className="space-y-1.5">
        <Label htmlFor="order-notes" className="text-sm font-semibold">
          Notas para el restaurante
        </Label>
        <Textarea
          id="order-notes"
          value={checkout.notes}
          maxLength={300}
          onChange={(event) => checkout.setNotes(event.target.value)}
          placeholder="Timbre dañado, llamar al llegar…"
          className="rounded-control min-h-20"
        />
      </div>

      <div className="flex justify-between md:hidden">
        <Button
          type="button"
          variant="ghost"
          className="rounded-pill h-12"
          onClick={() => checkout.goTo('entrega')}
        >
          <ChevronLeftIcon aria-hidden="true" />
          Atrás
        </Button>
        <Button
          type="button"
          className="rounded-pill h-12 px-6 text-base"
          onClick={() => checkout.goTo('resumen')}
        >
          Revisar pedido
        </Button>
      </div>
    </section>
  )
}
