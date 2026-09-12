'use client'

import { ShoppingBagIcon, Trash2Icon } from 'lucide-react'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { QuantityStepper } from '@/components/store/quantity-stepper'
import { StoreImage } from '@/components/store/store-image'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { formatCOP } from '@/lib/format'
import { computeLineTotal, meetsMinOrder } from '@/lib/pricing'
import { tableCheckoutPath, tableEntryPath } from '@/lib/tables/qr'
import { themeToCssVars } from '@/lib/theme'
import {
  selectCartQuantity,
  selectCartSubtotal,
  useCartStore,
} from '@/stores/cart.store'
import type { StoreTheme } from '@/types/app'

interface CartSheetProps {
  /** Minimum order of the store the cart belongs to; null when unknown. */
  minOrder: number | null
  storeName: string | null
  /** Present on a storefront: the sheet then wears the tenant skin. */
  theme?: StoreTheme
}

/** How full the basket is against the minimum, clamped to 0..1. */
function minimumProgress(subtotal: number, minOrder: number | null): number {
  if (!minOrder || minOrder <= 0) return 1
  return Math.max(0, Math.min(1, subtotal / minOrder))
}

export function CartSheet({ minOrder, storeName, theme }: CartSheetProps) {
  const isOpen = useCartStore((state) => state.isOpen)
  const setOpen = useCartStore((state) => state.setOpen)
  const items = useCartStore((state) => state.items)
  const storeSlug = useCartStore((state) => state.storeSlug)
  const table = useCartStore((state) => state.table)
  const setQuantity = useCartStore((state) => state.setQuantity)
  const remove = useCartStore((state) => state.remove)
  const clear = useCartStore((state) => state.clear)
  const quantity = useCartStore(selectCartQuantity)
  const subtotal = useCartStore(selectCartSubtotal)

  const minimumOk = meetsMinOrder(subtotal, minOrder)
  const missing = minOrder ? Math.max(0, minOrder - subtotal) : 0
  const progress = minimumProgress(subtotal, minOrder)
  // A cart tagged with a table checks out in place; no login required.
  const atTable = Boolean(table && storeSlug)
  const checkoutHref =
    table && storeSlug ? tableCheckoutPath(storeSlug, table.token) : '/checkout'
  const continueHref =
    table && storeSlug
      ? tableEntryPath(storeSlug, table.token)
      : storeSlug
        ? `/t/${storeSlug}`
        : null

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      {/* Portalled to the body, so the tenant skin travels with it. */}
      <SheetContent
        side="right"
        data-store-theme={theme ? '' : undefined}
        style={theme ? (themeToCssVars(theme) as CSSProperties) : undefined}
        className="flex w-full flex-col gap-0 bg-[var(--store-surface)] p-0 text-[var(--store-text)] sm:max-w-md"
      >
        <SheetHeader className="border-b border-[rgb(var(--store-text-rgb)/0.1)] px-5 py-4 text-left">
          <SheetTitle className="store-heading text-h3">Tu pedido</SheetTitle>
          <SheetDescription className="text-[rgb(var(--store-text-rgb)/0.65)]">
            {items.length > 0
              ? `${quantity} ${quantity === 1 ? 'producto' : 'productos'}${storeName ? ` de ${storeName}` : ''}`
              : 'Todavía no has agregado nada.'}
          </SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-[rgb(var(--store-text-rgb)/0.65)]">
            <ShoppingBagIcon
              aria-hidden="true"
              className="size-10 text-[rgb(var(--store-text-rgb)/0.35)]"
            />
            Explora el menú y toca un plato para empezar.
          </div>
        ) : (
          <ul className="flex-1 divide-y divide-[rgb(var(--store-text-rgb)/0.08)] overflow-y-auto px-5">
            {items.map((item) => (
              <li key={item.key} className="flex gap-3 py-4">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-[var(--store-image-radius)] bg-[rgb(var(--store-text-rgb)/0.06)]">
                  <StoreImage
                    src={item.imageUrl}
                    alt=""
                    seed={item.productId}
                    color={theme?.primary ?? '#C2410C'}
                    label={item.name}
                    sizes="64px"
                    initialScale={1.4}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  {item.options.length > 0 ? (
                    <p className="truncate text-xs text-[rgb(var(--store-text-rgb)/0.65)]">
                      {item.options.map((option) => option.value).join(', ')}
                    </p>
                  ) : null}
                  {item.notes ? (
                    <p className="truncate text-xs text-[rgb(var(--store-text-rgb)/0.65)] italic">
                      “{item.notes}”
                    </p>
                  ) : null}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <QuantityStepper
                      quantity={item.quantity}
                      itemLabel={item.name}
                      onDecrement={() =>
                        setQuantity(item.key, item.quantity - 1)
                      }
                      onIncrement={() =>
                        setQuantity(item.key, Math.min(50, item.quantity + 1))
                      }
                      className="bg-transparent text-[var(--store-text)] shadow-none [border:1px_solid_rgb(var(--store-text-rgb)/0.15)]"
                    />
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCOP(computeLineTotal(item))}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`Eliminar ${item.name}`}
                  onClick={() => remove(item.key)}
                  className="self-start text-[rgb(var(--store-text-rgb)/0.5)] transition-colors hover:text-[var(--destructive)]"
                >
                  <Trash2Icon aria-hidden="true" className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {items.length > 0 ? (
          <div className="space-y-3 border-t border-[rgb(var(--store-text-rgb)/0.1)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <dl className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-[rgb(var(--store-text-rgb)/0.65)]">
                  Subtotal
                </dt>
                <dd className="font-semibold tabular-nums">
                  {formatCOP(subtotal)}
                </dd>
              </div>
              <div className="flex items-center justify-between text-xs text-[rgb(var(--store-text-rgb)/0.6)]">
                <dt>
                  {atTable ? 'Servicio a la mesa' : 'Domicilio y propina'}
                </dt>
                <dd>
                  {atTable && table
                    ? `Mesa ${table.number}`
                    : 'Se calculan en el siguiente paso'}
                </dd>
              </div>
            </dl>

            {!minimumOk && minOrder ? (
              <div className="space-y-1.5">
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={minOrder}
                  aria-valuenow={subtotal}
                  aria-label="Avance hacia el pedido mínimo"
                  className="h-2 w-full overflow-hidden rounded-full bg-[rgb(var(--store-text-rgb)/0.1)]"
                >
                  <div
                    className="h-full rounded-full bg-[var(--store-primary)] transition-[width] duration-[var(--store-motion-duration)] ease-[var(--ease-out-soft)]"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
                <p
                  role="status"
                  className="text-xs text-[rgb(var(--store-text-rgb)/0.75)]"
                >
                  Te faltan{' '}
                  <strong className="font-semibold text-[var(--store-primary)]">
                    {formatCOP(missing)}
                  </strong>{' '}
                  para el mínimo de {formatCOP(minOrder)}.
                </p>
              </div>
            ) : null}

            <Button
              asChild={minimumOk}
              disabled={!minimumOk}
              className="h-12 w-full rounded-[var(--store-button-radius)] bg-[var(--store-primary)] text-base text-[var(--store-on-primary)] hover:bg-[var(--store-primary)]/90"
              onClick={() => minimumOk && setOpen(false)}
            >
              {minimumOk ? (
                <Link href={checkoutHref}>
                  Ir a pagar · {formatCOP(subtotal)}
                </Link>
              ) : (
                <span>Ir a pagar · {formatCOP(subtotal)}</span>
              )}
            </Button>

            <div className="flex justify-between">
              {continueHref ? (
                <Button
                  asChild
                  variant="link"
                  size="sm"
                  className="px-0 text-[var(--store-primary)]"
                  onClick={() => setOpen(false)}
                >
                  <Link href={continueHref}>Seguir pidiendo</Link>
                </Button>
              ) : (
                <span />
              )}
              <Button
                variant="link"
                size="sm"
                className="text-destructive px-0"
                onClick={clear}
              >
                Vaciar carrito
              </Button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
