'use client'

import Link from 'next/link'
import { CheckoutProgress } from './checkout-progress'
import { DeliveryStep } from './delivery-step'
import { OrderSummary } from './order-summary'
import { PaymentStep } from './payment-step'
import { STEPS, type Step } from './steps'
import { useCheckout } from './use-checkout'
import { AddressFormDialog } from '@/components/address/address-form'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import type { PaymentOption } from '@/lib/payments'
import type { Address } from '@/types/app'

interface CheckoutFormProps {
  addresses: Address[]
  paymentOptions: PaymentOption[]
}

/**
 * The checkout shell.
 *
 * One flow, two shapes. On a phone it is three steps behind a progress bar,
 * so each screen asks one question. From `md` up every panel is on screen at
 * once and the summary sticks to the side, because on a laptop hiding the
 * total behind a "next" button is just friction. The step machine still runs
 * underneath — it is only the visibility rule that changes.
 */
export function CheckoutForm({ addresses, paymentOptions }: CheckoutFormProps) {
  const checkout = useCheckout({ addresses, paymentOptions })

  if (!checkout.ready) {
    return (
      <div className="gap-card grid lg:grid-cols-[1.4fr_1fr]">
        <Skeleton className="rounded-card h-96" />
        <Skeleton className="rounded-card h-72" />
      </div>
    )
  }

  if (checkout.cart.items.length === 0 || !checkout.store) {
    return (
      <EmptyState
        title="Tu carrito está vacío"
        description="Agrega productos de un restaurante para continuar con el pago."
        action={
          <Button asChild className="rounded-pill">
            <Link href="/#restaurantes">Explorar restaurantes</Link>
          </Button>
        }
      />
    )
  }

  /** One step at a time on a phone; everything at once from `md`. */
  const visible = (target: Step) =>
    checkout.step === target ? 'block' : 'hidden md:block'

  return (
    <>
      <CheckoutProgress
        steps={STEPS}
        current={checkout.step}
        onSelect={checkout.goTo}
      />

      <div className="gap-card grid lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="gap-card grid content-start">
          <DeliveryStep checkout={checkout} className={visible('entrega')} />
          <PaymentStep checkout={checkout} className={visible('pago')} />
        </div>
        <OrderSummary checkout={checkout} className={visible('resumen')} />
      </div>

      <AddressFormDialog
        open={checkout.addressDialog}
        onOpenChange={checkout.setAddressDialog}
        onSaved={checkout.addAddress}
      />
    </>
  )
}
