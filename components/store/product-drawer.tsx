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
      <DrawerContent
        data-store-theme
        style={themeToCssVars(theme) as CSSProperties}
        className="mx-auto flex max-h-[94dvh] max-w-lg flex-col rounded-t-[var(--store-radius)] bg-[var(--store-surface)] text-[var(--store-text)]"
      >
        {product ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="relative aspect-[16/10] w-full overflow-hidden sm:aspect-[3/2]">
                <StoreImage
                  src={product.image_url}
                  alt={product.name}
                  seed={product.id}
                  color={theme.primary}
                  label={product.name}
                  sizes="(min-width: 640px) 512px, 100vw"
                  initialScale={2.2}
                />
              </div>

              <DrawerHeader className="text-left">
                <DrawerTitle className="store-heading text-h2">
                  {product.name}
                </DrawerTitle>
                <DrawerDescription className="text-[rgb(var(--store-text-rgb)/0.7)]">
                  {product.description ?? 'Sin descripción.'}
                </DrawerDescription>
                <p className="text-lead pt-1 font-semibold text-[var(--store-primary)]">
                  {formatCOP(Number(product.price))}
                </p>
              </DrawerHeader>

              <div className="space-y-6 px-4 pb-6">
                {options.map((option) => {
                  const max = Math.max(1, option.max)
                  const values = [...option.product_option_values].sort(
                    (a, b) => a.position - b.position,
                  )
                  const error = touched ? errors[option.id] : undefined
                  return (
                    <fieldset key={option.id} className="space-y-2">
                      <legend className="flex w-full items-baseline justify-between text-sm font-semibold">
                        {option.name}
                        <span className="text-xs font-normal text-[rgb(var(--store-text-rgb)/0.75)]">
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
                                // 44px minimum: this is the control people
                                // actually tap, often one-handed.
                                'flex min-h-[44px] items-center justify-between gap-3 rounded-[var(--store-button-radius)] border px-4 py-3 text-left text-sm transition-colors',
                                checked
                                  ? 'border-[var(--store-primary)] bg-[rgb(var(--store-primary-rgb)/0.1)]'
                                  : 'border-[rgb(var(--store-text-rgb)/0.12)] hover:bg-[rgb(var(--store-text-rgb)/0.04)]',
                              )}
                            >
                              <span className="flex items-center gap-3">
                                <span
                                  aria-hidden="true"
                                  className={cn(
                                    'flex size-6 shrink-0 items-center justify-center border transition-colors',
                                    max > 1 ? 'rounded-md' : 'rounded-full',
                                    checked
                                      ? 'border-[var(--store-primary)] bg-[var(--store-primary)] text-[var(--store-on-primary)]'
                                      : 'border-[rgb(var(--store-text-rgb)/0.3)]',
                                  )}
                                >
                                  {checked ? (
                                    <CheckIcon className="size-4" />
                                  ) : null}
                                </span>
                                {value.name}
                              </span>
                              {Number(value.price_delta) !== 0 ? (
                                <span className="text-xs text-[rgb(var(--store-text-rgb)/0.7)] tabular-nums">
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

                <div className="space-y-1.5">
                  <Label
                    htmlFor={`notes-${product.id}`}
                    className="text-sm font-semibold"
                  >
                    Notas para la cocina
                  </Label>
                  <Textarea
                    id={`notes-${product.id}`}
                    value={notes}
                    maxLength={200}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Sin cebolla, salsa aparte…"
                    className="min-h-20 rounded-[var(--store-button-radius)] border-[rgb(var(--store-text-rgb)/0.12)] bg-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3 border-t border-[rgb(var(--store-text-rgb)/0.1)] bg-[var(--store-surface)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <QuantityStepper
                size="md"
                quantity={quantity}
                allowRemove={false}
                itemLabel={product.name}
                onDecrement={() =>
                  setQuantity((value) => Math.max(1, value - 1))
                }
                onIncrement={() =>
                  setQuantity((value) => Math.min(50, value + 1))
                }
                className="bg-transparent text-[var(--store-text)] shadow-none [border:1px_solid_rgb(var(--store-text-rgb)/0.15)]"
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
