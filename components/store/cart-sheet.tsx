'use client'

import { MinusIcon, PlusIcon, ShoppingBagIcon, Trash2Icon } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
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
import {
  selectCartQuantity,
  selectCartSubtotal,
  useCartStore,
} from '@/stores/cart.store'

interface CartSheetProps {
  /** Minimum order of the store the cart belongs to; null when unknown. */
  minOrder: number | null
  storeName: string | null
}

export function CartSheet({ minOrder, storeName }: CartSheetProps) {
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
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-border border-b px-5 py-4 text-left">
          <SheetTitle className="font-display text-2xl">Tu pedido</SheetTitle>
          <SheetDescription>
            {items.length > 0
              ? `${quantity} ${quantity === 1 ? 'producto' : 'productos'}${storeName ? ` de ${storeName}` : ''}`
              : 'Todavía no has agregado nada.'}
          </SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-sm">
            <ShoppingBagIcon
              aria-hidden="true"
              className="text-muted-foreground/50 size-10"
            />
            Explora el menú y toca un plato para empezar.
          </div>
        ) : (
          <ul className="divide-border flex-1 divide-y overflow-y-auto px-5">
            {items.map((item) => (
              <li key={item.key} className="flex gap-3 py-4">
                <div className="rounded-control bg-muted relative size-16 shrink-0 overflow-hidden">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  {item.options.length > 0 ? (
                    <p className="text-muted-foreground truncate text-xs">
                      {item.options.map((option) => option.value).join(', ')}
                    </p>
                  ) : null}
                  {item.notes ? (
                    <p className="text-muted-foreground truncate text-xs italic">
                      “{item.notes}”
                    </p>
                  ) : null}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="rounded-pill border-border flex items-center border">
                      <button
                        type="button"
                        aria-label={`Quitar uno de ${item.name}`}
                        onClick={() => setQuantity(item.key, item.quantity - 1)}
                        className="flex size-8 items-center justify-center"
                      >
                        {item.quantity === 1 ? (
                          <Trash2Icon
                            aria-hidden="true"
                            className="text-destructive size-3.5"
                          />
                        ) : (
                          <MinusIcon aria-hidden="true" className="size-3.5" />
                        )}
                      </button>
                      <span className="w-6 text-center text-sm tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label={`Agregar uno de ${item.name}`}
                        onClick={() =>
                          setQuantity(item.key, Math.min(50, item.quantity + 1))
                        }
                        className="flex size-8 items-center justify-center"
                      >
                        <PlusIcon aria-hidden="true" className="size-3.5" />
                      </button>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCOP(computeLineTotal(item))}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`Eliminar ${item.name}`}
                  onClick={() => remove(item.key)}
                  className="text-muted-foreground hover:text-destructive self-start"
                >
                  <Trash2Icon aria-hidden="true" className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {items.length > 0 ? (
          <div className="border-border space-y-3 border-t p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold tabular-nums">
                {formatCOP(subtotal)}
              </span>
            </div>
            {!minimumOk && minOrder ? (
              <p role="status" className="text-destructive text-xs">
                El pedido mínimo es {formatCOP(minOrder)}. Te faltan{' '}
                {formatCOP(minOrder - subtotal)}.
              </p>
            ) : atTable && table ? (
              <p className="text-muted-foreground text-xs">
                Pedido para la mesa {table.number}. Sin costo de domicilio.
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Domicilio y propina se calculan en el siguiente paso.
              </p>
            )}
            <Button
              asChild={minimumOk}
              disabled={!minimumOk}
              className="rounded-pill h-12 w-full text-base"
              onClick={() => setOpen(false)}
            >
              {minimumOk ? (
                <Link href={checkoutHref}>
                  Ir a pagar · {formatCOP(subtotal)}
                </Link>
              ) : (
                <span>Ir a pagar</span>
              )}
            </Button>
            <div className="flex justify-between">
              {continueHref ? (
                <Button
                  asChild
                  variant="link"
                  size="sm"
                  className="px-0"
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
