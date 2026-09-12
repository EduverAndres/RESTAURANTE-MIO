'use client'

import {
  ChevronLeftIcon,
  ClockIcon,
  LoaderCircleIcon,
  ShoppingBagIcon,
} from 'lucide-react'
import Link from 'next/link'
import type { CheckoutController } from './use-checkout'
import { Button } from '@/components/ui/button'
import { formatCOP } from '@/lib/format'
import { computeLineTotal } from '@/lib/pricing'
import { cn } from '@/lib/utils'

function Row({
  label,
  value,
  emphasis = false,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div
      className={cn(
        'flex justify-between',
        emphasis && 'border-border border-t pt-2 text-base font-semibold',
      )}
    >
      <dt className={emphasis ? undefined : 'text-muted-foreground'}>
        {label}
      </dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}

/**
 * The receipt. On a wide screen it sticks to the top of the viewport and
 * stays visible through both steps, because the running total is the number
 * people check before every single tap; on a phone it is the third step.
 */
export function OrderSummary({
  checkout,
  className,
}: {
  checkout: CheckoutController
  className?: string
}) {
  const { store, totals } = checkout
  if (!store) return null

  return (
    <aside
      className={cn(
        'rounded-card border-border bg-card shadow-1 p-card space-y-4 border',
        'lg:sticky lg:top-[calc(var(--app-header-h)+1.5rem)]',
        className,
      )}
      aria-labelledby="resumen-title"
    >
      <div className="flex items-center gap-2">
        <ShoppingBagIcon aria-hidden="true" className="text-primary size-5" />
        <h2 id="resumen-title" className="text-h3 font-display font-semibold">
          Resumen
        </h2>
      </div>
      <p className="text-muted-foreground text-sm">
        Pedido a{' '}
        <Link
          href={`/t/${store.slug}`}
          className="text-foreground font-medium underline-offset-4 hover:underline"
        >
          {store.name}
        </Link>
      </p>

      <ul className="divide-border divide-y">
        {checkout.cart.items.map((item) => (
          <li
            key={item.key}
            className="flex justify-between gap-3 py-2 text-sm"
          >
            <span className="min-w-0">
              <span className="block truncate">
                {item.quantity}× {item.name}
              </span>
              {item.options.length > 0 ? (
                <span className="text-muted-foreground block truncate text-xs">
                  {item.options.map((option) => option.value).join(', ')}
                </span>
              ) : null}
            </span>
            <span className="tabular-nums">
              {formatCOP(computeLineTotal(item))}
            </span>
          </li>
        ))}
      </ul>

      <dl className="space-y-1.5 text-sm">
        <Row label="Subtotal" value={formatCOP(totals.subtotal)} />
        <Row
          label="Domicilio"
          value={
            checkout.type === 'delivery'
              ? formatCOP(totals.deliveryFee)
              : 'Gratis'
          }
        />
        <Row label="Propina" value={formatCOP(totals.tip)} />
        <Row label="Total" value={formatCOP(totals.total)} emphasis />
      </dl>

      {checkout.eta ? (
        <p className="rounded-pill bg-muted text-muted-foreground inline-flex items-center gap-1.5 px-3 py-1 text-xs">
          <ClockIcon aria-hidden="true" className="size-3.5" />
          Tiempo estimado: {checkout.eta} min
        </p>
      ) : null}

      {!checkout.minimumOk ? (
        <p role="alert" className="text-destructive text-xs">
          El pedido mínimo de {store.name} es {formatCOP(store.minOrder)}.
        </p>
      ) : null}

      <Button
        type="button"
        onClick={checkout.submit}
        disabled={
          checkout.pending || !checkout.minimumOk || checkout.outOfRange
        }
        className="rounded-pill h-14 w-full text-base"
      >
        {checkout.pending ? (
          <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
        ) : null}
        {checkout.paymentMethod === 'cash'
          ? 'Confirmar pedido'
          : `Pagar ${formatCOP(totals.total)}`}
      </Button>
      <p className="text-muted-foreground text-center text-xs">
        Podrás cancelar mientras el restaurante no lo acepte.
      </p>

      <div className="md:hidden">
        <Button
          type="button"
          variant="ghost"
          className="rounded-pill w-full"
          onClick={() => checkout.goTo('pago')}
        >
          <ChevronLeftIcon aria-hidden="true" />
          Volver al pago
        </Button>
      </div>
    </aside>
  )
}
