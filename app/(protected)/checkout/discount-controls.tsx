'use client'

import { GiftIcon, LoaderCircleIcon, TicketIcon, XIcon } from 'lucide-react'
import { useId, useState } from 'react'
import type { CheckoutController } from './use-checkout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCOP } from '@/lib/format'

/**
 * Coupon field, loyalty reward and referral credit, above the totals. Only
 * what applies to this customer and store is shown: someone with no card
 * and no credit sees one quiet coupon field.
 */
export function DiscountControls({
  checkout,
}: {
  checkout: CheckoutController
}) {
  const inputId = useId()
  const errorId = useId()
  const [code, setCode] = useState('')
  const { coupon, perks, discounts } = checkout
  const loyalty = perks.loyalty

  return (
    <div className="space-y-3">
      {loyalty ? (
        <div className="rounded-control bg-muted/60 space-y-1 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium">
            <GiftIcon aria-hidden="true" className="text-primary size-4" />
            {checkout.rewardAvailable
              ? `Tienes un premio: ${loyalty.rewardLabel}`
              : `Llevas ${loyalty.stamps} de ${loyalty.required} sellos`}
          </p>
          {checkout.rewardAvailable ? (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={checkout.useReward}
                onChange={(event) =>
                  checkout.setUseReward(event.target.checked)
                }
                className="accent-primary size-4"
              />
              Usarlo en este pedido (hasta {formatCOP(loyalty.rewardValue)})
            </label>
          ) : (
            <p className="text-muted-foreground text-xs">
              Cada pedido entregado desde {formatCOP(loyalty.minOrder)} suma un
              sello. Con {loyalty.required} tienes {loyalty.rewardLabel}.
            </p>
          )}
        </div>
      ) : null}

      {coupon ? (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <TicketIcon aria-hidden="true" className="text-primary size-4" />
            Cupón <strong className="font-mono">{coupon.code}</strong>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={checkout.removeCoupon}
            className="rounded-pill"
          >
            <XIcon aria-hidden="true" />
            Quitar
          </Button>
        </div>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            checkout.applyCoupon(code)
          }}
        >
          <label htmlFor={inputId} className="sr-only">
            Código de cupón
          </label>
          <Input
            id={inputId}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="¿Tienes un cupón?"
            autoComplete="off"
            className="rounded-control h-10 uppercase"
          />
          <Button
            type="submit"
            variant="outline"
            disabled={checkout.checkingCoupon || code.trim() === ''}
            className="rounded-pill h-10"
          >
            {checkout.checkingCoupon ? (
              <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
            ) : null}
            Aplicar
          </Button>
        </form>
      )}
      {checkout.couponError ? (
        <p id={errorId} role="alert" className="text-destructive text-xs">
          {checkout.couponError}
        </p>
      ) : null}

      {discounts.platformDiscount > 0 ? (
        <p className="text-success-on-tint text-xs">
          Se aplica tu crédito por invitación de{' '}
          {formatCOP(discounts.platformDiscount)}. Lo pone Cerquita.
        </p>
      ) : null}
    </div>
  )
}
