'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CheckIcon } from 'lucide-react'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { toast } from 'sonner'
import { QuantityStepper } from '@/components/store/quantity-stepper'
import { StoreImage } from '@/components/store/store-image'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { CartStoreRef } from '@/lib/cart'
import { formatCOP } from '@/lib/format'
import { computeLineTotal } from '@/lib/pricing'
import { themeToCssVars } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { useCartStore } from '@/stores/cart.store'
import type {
  OrderItemOption,
  ProductWithOptions,
  StoreTheme,
} from '@/types/app'

interface ProductDrawerProps {
  product: ProductWithOptions | null
  theme: StoreTheme
  store: CartStoreRef & { isOpen: boolean }
  onClose: () => void
}

type Selection = Record<string, string[]>

function initialSelection(product: ProductWithOptions | null): Selection {
  const selection: Selection = {}
  product?.product_options.forEach((option) => {
    selection[option.id] = []
  })
  return selection
}

/**
 * The configuration surface: only opened for a product that actually has
 * choices to make. Vaul owns the focus trap, the Escape key and returning
 * focus to the card that opened it; everything here is about making the
 * choices big enough to hit and the running total impossible to miss.
 */
export function ProductDrawer({
  product,
  theme,
  store,
  onClose,
}: ProductDrawerProps) {
  const add = useCartStore((state) => state.add)
  const setCartOpen = useCartStore((state) => state.setOpen)
  const reduceMotion = useReducedMotion()
  const animate = !reduceMotion && theme.motion !== 'none'
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const [selection, setSelection] = useState<Selection>({})
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    setQuantity(1)
    setNotes('')
    setSelection(initialSelection(product))
    setTouched(false)
  }, [product])

  const options = useMemo(() => {
    if (!product) return []
    return [...product.product_options].sort((a, b) => a.position - b.position)
  }, [product])

  const chosen: OrderItemOption[] = useMemo(() => {
    const result: OrderItemOption[] = []
    options.forEach((option) => {
      const values = [...option.product_option_values].sort(
        (a, b) => a.position - b.position,
      )
      ;(selection[option.id] ?? []).forEach((valueId) => {
        const value = values.find((candidate) => candidate.id === valueId)
        if (value) {
          result.push({
            option: option.name,
            value: value.name,
            price_delta: Number(value.price_delta),
          })
        }
      })
    })
    return result
  }, [options, selection])

  const errors = useMemo(() => {
    const map: Record<string, string> = {}
    options.forEach((option) => {
      const count = selection[option.id]?.length ?? 0
      const min = option.required ? Math.max(1, option.min) : option.min
      if (count < min) {
        map[option.id] =
          min === 1 ? 'Elige una opción.' : `Elige al menos ${min}.`
      }
    })
    return map
  }, [options, selection])

  const lineTotal = product
    ? computeLineTotal({
        unitPrice: Number(product.price),
        quantity,
        options: chosen,
      })
    : 0

  function toggle(optionId: string, valueId: string, max: number) {
    setSelection((current) => {
      const values = current[optionId] ?? []
      if (max <= 1)
        return {
          ...current,
          [optionId]: values[0] === valueId ? [] : [valueId],
        }
      if (values.includes(valueId)) {
        return { ...current, [optionId]: values.filter((id) => id !== valueId) }
      }
      if (values.length >= max) return current
      return { ...current, [optionId]: [...values, valueId] }
    })
  }

  function submit() {
    if (!product) return
    setTouched(true)
    if (Object.keys(errors).length > 0) return
    if (!store.isOpen) {
      toast.error('Este restaurante está cerrado en este momento.')
      return
    }
    add(
      {
        storeId: store.storeId,
        storeSlug: store.storeSlug,
        table: store.table ?? null,
      },
      {
        productId: product.id,
        name: product.name,
        unitPrice: Number(product.price),
        imageUrl: product.image_url,
        options: chosen,
        optionValueIds: Object.values(selection).flat(),
        notes: notes.trim(),
      },
      quantity,
    )
    toast.success(`${product.name} agregado al carrito.`, {
      action: { label: 'Ver carrito', onClick: () => setCartOpen(true) },
    })
    onClose()
  }

  return (
    <Drawer open={product !== null} onOpenChange={(open) => !open && onClose()}>
      {/* The drawer is portalled to the body, outside the storefront wrapper,
          so it has to carry the tenant skin itself or it would render in the
          app's default palette. */}
      {/* Overrides of the base sheet carry `!`: its defaults are written as
          `data-[vaul-drawer-direction=bottom]:…`, which outrank a plain class,
          so without it the tenant radius and height silently lose. Every
          horizontal edge uses the same gutter (px-4 / sm:px-6) so the image,
          the text, the options and the footer line up on one rail. */}
      <DrawerContent
        data-store-theme
        style={themeToCssVars(theme) as CSSProperties}
        className={cn(
          'mx-auto flex max-w-lg flex-col overflow-hidden bg-[var(--store-surface)] text-[var(--store-text)]',
          'max-h-[94dvh]! rounded-t-[var(--store-sheet-radius)]! border-[rgb(var(--store-text-rgb)/0.08)]',
          // Desktop: a floating card, not a strip glued to the window edge.
          'sm:bottom-4! sm:max-h-[calc(100dvh-2rem)]! sm:rounded-[var(--store-sheet-radius)]! sm:border sm:shadow-[0_24px_64px_-16px_rgb(0_0_0/0.35)]',
          // The grab handle, in the tenant ink instead of the app grey.
          '[&>div:first-child]:mt-2.5 [&>div:first-child]:mb-0.5 [&>div:first-child]:w-10 [&>div:first-child]:bg-[rgb(var(--store-text-rgb)/0.18)]',
        )}
      >
        {product ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-color:rgb(var(--store-text-rgb)/0.2)_transparent] [scrollbar-width:thin]">
              <div className="px-4 pt-3 sm:px-6">
                <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[var(--store-inner-radius)] bg-[rgb(var(--store-text-rgb)/0.05)] sm:aspect-[3/2]">
                  <StoreImage
                    src={product.image_url}
                    alt={product.name}
                    seed={product.id}
                    color={theme.primary}
                    label={product.name}
                    sizes="(min-width: 640px) 464px, 100vw"
                    initialScale={2.2}
                  />
                </div>
              </div>

              <DrawerHeader className="gap-1.5! px-4 pt-5 pb-0 text-left! sm:px-6">
                {/* No text colour class here: the drawer's `cn` reads
                    `text-h2` as a colour and would drop it for the other one.
                    The colour is inherited from the sheet. */}
                <DrawerTitle className="store-heading text-h2 leading-tight">
                  {product.name}
                </DrawerTitle>
                <DrawerDescription className="text-sm leading-relaxed text-[rgb(var(--store-text-rgb)/0.7)]">
                  {product.description ?? 'Sin descripción.'}
                </DrawerDescription>
                <p className="text-lead pt-1 font-semibold text-[var(--store-primary)] tabular-nums">
                  {formatCOP(Number(product.price))}
                </p>
              </DrawerHeader>

              <div className="mt-5 space-y-6 border-t border-[rgb(var(--store-text-rgb)/0.08)] px-4 pt-5 pb-6 sm:px-6">
                {options.map((option) => {
                  const max = Math.max(1, option.max)
                  const values = [...option.product_option_values].sort(
                    (a, b) => a.position - b.position,
                  )
                  const error = touched ? errors[option.id] : undefined
                  return (
                    <fieldset key={option.id} className="space-y-2.5">
                      <legend className="mb-2.5 flex w-full items-center justify-between gap-3 text-sm font-semibold">
                        {option.name}
                        <span
                          className={cn(
                            'rounded-pill px-2.5 py-0.5 text-[11px] font-medium',
                            option.required
                              ? 'bg-[rgb(var(--store-primary-rgb)/0.12)] text-[var(--store-primary)]'
                              : 'bg-[rgb(var(--store-text-rgb)/0.06)] text-[rgb(var(--store-text-rgb)/0.75)]',
                          )}
                        >
                          {option.required ? 'Obligatorio' : 'Opcional'}
                          {max > 1 ? ` · hasta ${max}` : ''}
                        </span>
                      </legend>
                      <div
                        role={max > 1 ? 'group' : 'radiogroup'}
                        aria-label={option.name}
                        className="grid gap-2"
                      >
                        {values.map((value) => {
                          const checked = (selection[option.id] ?? []).includes(
                            value.id,
                          )
                          return (
                            <button
                              key={value.id}
                              type="button"
                              role={max > 1 ? 'checkbox' : 'radio'}
                              aria-checked={checked}
                              onClick={() => toggle(option.id, value.id, max)}
                              className={cn(
                                // 48px: this is the control people actually
                                // tap, often one-handed. Field radius, not
                                // button radius: a pill theme would turn a
                                // two-line option into a capsule.
                                'flex min-h-12 items-center justify-between gap-3 rounded-[var(--store-field-radius)] border px-4 py-3 text-left text-sm font-medium transition-colors',
                                checked
                                  ? 'border-[var(--store-primary)] bg-[rgb(var(--store-primary-rgb)/0.08)]'
                                  : 'border-[rgb(var(--store-text-rgb)/0.12)] hover:border-[rgb(var(--store-text-rgb)/0.24)] hover:bg-[rgb(var(--store-text-rgb)/0.03)]',
                              )}
                            >
                              <span className="flex items-center gap-3">
                                <span
                                  aria-hidden="true"
                                  className={cn(
                                    'flex size-5 shrink-0 items-center justify-center border-[1.5px] transition-colors',
                                    max > 1
                                      ? 'rounded-[min(6px,var(--store-field-radius))]'
                                      : 'rounded-full',
                                    checked
                                      ? 'border-[var(--store-primary)] bg-[var(--store-primary)] text-[var(--store-on-primary)]'
                                      : 'border-[rgb(var(--store-text-rgb)/0.3)]',
                                  )}
                                >
                                  {checked ? (
                                    <CheckIcon
                                      className="size-3.5"
                                      strokeWidth={3}
                                    />
                                  ) : null}
                                </span>
                                {value.name}
                              </span>
                              {Number(value.price_delta) !== 0 ? (
                                <span className="shrink-0 text-sm font-normal text-[rgb(var(--store-text-rgb)/0.65)] tabular-nums">
                                  {Number(value.price_delta) > 0 ? '+' : ''}
                                  {formatCOP(Number(value.price_delta))}
                                </span>
                              ) : null}
                            </button>
                          )
                        })}
                      </div>
                      {error ? (
                        <p role="alert" className="text-destructive text-xs">
                          {error}
                        </p>
                      ) : null}
                    </fieldset>
                  )
                })}

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <Label
                      htmlFor={`notes-${product.id}`}
                      className="text-sm font-semibold"
                    >
                      Notas para la cocina
                    </Label>
                    <span
                      aria-hidden="true"
                      className="text-[11px] text-[rgb(var(--store-text-rgb)/0.5)] tabular-nums"
                    >
                      {notes.length}/200
                    </span>
                  </div>
                  <Textarea
                    id={`notes-${product.id}`}
                    value={notes}
                    maxLength={200}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Sin cebolla, salsa aparte…"
                    className="min-h-24 resize-none rounded-[var(--store-field-radius)] border-[rgb(var(--store-text-rgb)/0.12)] bg-transparent px-4 py-3 placeholder:text-[rgb(var(--store-text-rgb)/0.45)] focus-visible:border-[var(--store-primary)] focus-visible:ring-[rgb(var(--store-primary-rgb)/0.18)] dark:bg-transparent"
                  />
                </div>
              </div>
            </div>

            {/* items-stretch: the stepper takes the button's height, including
                the 56px table-mode target, so the two never sit unevenly. */}
            <div className="flex shrink-0 items-stretch gap-3 border-t border-[rgb(var(--store-text-rgb)/0.08)] bg-[var(--store-surface)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
              <QuantityStepper
                size="lg"
                quantity={quantity}
                allowRemove={false}
                itemLabel={product.name}
                onDecrement={() =>
                  setQuantity((value) => Math.max(1, value - 1))
                }
                onIncrement={() =>
                  setQuantity((value) => Math.min(50, value + 1))
                }
                // An inset ring instead of a border: it draws the same line
                // without adding 2px to the height.
                className="bg-transparent text-[var(--store-text)] shadow-[inset_0_0_0_1px_rgb(var(--store-text-rgb)/0.15)]"
              />
              <motion.button
                type="button"
                onClick={submit}
                whileTap={animate ? { scale: 0.97 } : undefined}
                data-table-primary=""
                className="store-btn h-12 flex-1 text-base"
              >
                Agregar ·{' '}
                <span className="relative inline-flex tabular-nums">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={lineTotal}
                      initial={animate ? { y: 10, opacity: 0 } : false}
                      animate={{ y: 0, opacity: 1 }}
                      exit={animate ? { y: -10, opacity: 0 } : { opacity: 0 }}
                      transition={{ duration: 0.16 }}
                    >
                      {formatCOP(lineTotal)}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </motion.button>
            </div>
          </>
        ) : null}
      </DrawerContent>
    </Drawer>
  )
}
