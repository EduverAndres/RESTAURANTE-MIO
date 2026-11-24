'use client'

import { ChevronLeftIcon } from 'lucide-react'
import { OptionCard } from './option-card'
import { PaymentMark } from './payment-mark'
import type { CheckoutController } from './use-checkout'
import { WompiTrust } from '@/components/payments/wompi-trust'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatCOP } from '@/lib/format'
import { TIP_PRESETS, computeTip } from '@/lib/pricing'
import { cn } from '@/lib/utils'

/**
 * "Cuenta de empresa — X": only for an active member of a company, so it is
 * not in the list every customer gets. Shows what is left to spend, and once
 * chosen asks what the order is for (the company sees it on its statement).
 * When the company cannot pay today the card stays visible, disabled, with
 * the reason, so nobody wonders where their company went.
 */
function CorporateOption({ checkout }: { checkout: CheckoutController }) {
  const option = checkout.corporateOption
  if (!option) return null
  const checked = checkout.paymentMethod === 'corporate'
  const title = `Cuenta de empresa — ${option.companyName}`

  if (option.blocked) {
    return (
      <div
        role="radio"
        aria-checked={false}
        aria-disabled="true"
        className="rounded-card border-border bg-muted/40 flex min-h-14 w-full items-center gap-3 border border-dashed p-3"
      >
        <PaymentMark method="corporate" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{title}</span>
          <span className="text-muted-foreground block text-xs">
            {option.blocked}
          </span>
        </span>
      </div>
    )
  }

  return (
    <>
      <OptionCard
        checked={checked}
        onSelect={() => checkout.setPaymentMethod('corporate')}
        leading={<PaymentMark method="corporate" />}
        title={title}
        hint={`Disponible: ${formatCOP(option.available)}${
          option.perOrderLimit !== null
            ? ` · tope por pedido ${formatCOP(option.perOrderLimit)}`
            : ''
        }`}
      />
      {checked ? (
        <div className="rounded-card bg-primary/6 space-y-1.5 p-3">
          <Label
            htmlFor="corporate-reference"
            className="text-sm font-semibold"
          >
            Motivo o centro de costo{' '}
            <span className="text-muted-foreground font-normal">
              (opcional)
            </span>
          </Label>
          <Input
            id="corporate-reference"
            value={checkout.corporateReference}
            maxLength={80}
            onChange={(event) =>
              checkout.setCorporateReference(event.target.value)
            }
            placeholder="Almuerzo de equipo, CC-102…"
            className="rounded-control bg-card h-11"
            aria-describedby="corporate-reference-hint"
          />
          <p
            id="corporate-reference-hint"
            className="text-muted-foreground text-xs text-pretty"
          >
            Aparece en el estado de cuenta de tu empresa. Lo paga tu empresa: el
            premio de sellos y los créditos por invitación no aplican.
          </p>
          {checkout.corporateIssue ? (
            <p role="alert" className="text-destructive text-xs font-medium">
              {checkout.corporateIssue}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

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
                  // Full strength: at 80% the amount on the brand orange
                  // fell to 3.85:1, under the 4.5:1 small text needs.
                  active ? 'text-primary-foreground' : 'text-muted-foreground',
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
        <CorporateOption checkout={checkout} />
      </div>

      {checkout.paymentOptions.some((option) => option.method === 'wompi') ? (
        <WompiTrust />
      ) : null}

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
