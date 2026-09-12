'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { CheckIcon, MinusIcon, PlusIcon } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import { cn } from '@/lib/utils'
import { useCartStore } from '@/stores/cart.store'
import type { OrderItemOption, ProductWithOptions } from '@/types/app'

interface ProductDrawerProps {
  product: ProductWithOptions | null
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

export function ProductDrawer({ product, store, onClose }: ProductDrawerProps) {
  const add = useCartStore((state) => state.add)
  const setCartOpen = useCartStore((state) => state.setOpen)
  const reduceMotion = useReducedMotion()
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
      <DrawerContent className="mx-auto max-h-[92dvh] max-w-lg rounded-t-[var(--store-radius)] bg-[var(--store-surface)] text-[var(--store-text)]">
        {product ? (
          <>
            <div className="overflow-y-auto">
              {product.image_url ? (
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                  <Image
                    src={product.image_url}
                    alt={product.name}
                    fill
                    sizes="(min-width: 640px) 512px, 100vw"
                    className="object-cover"
                  />
                </div>
              ) : null}
              <DrawerHeader className="text-left">
                <DrawerTitle className="font-[family-name:var(--store-font-display)] text-2xl font-semibold">
                  {product.name}
                </DrawerTitle>
                <DrawerDescription className="text-[rgb(var(--store-text-rgb)/0.7)]">
                  {product.description ?? 'Sin descripción.'}
                </DrawerDescription>
                <p className="pt-1 text-lg font-semibold text-[var(--store-primary)]">
                  {formatCOP(Number(product.price))}
                </p>
              </DrawerHeader>

              <div className="space-y-6 px-4 pb-4">
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
                        <span className="text-xs font-normal text-[rgb(var(--store-text-rgb)/0.6)]">
                          {option.required ? 'Obligatorio' : 'Opcional'}
                          {max > 1 ? ` · hasta ${max}` : ''}
                        </span>
                      </legend>
                      <div className="grid gap-1.5">
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
                                'flex items-center justify-between rounded-[var(--store-button-radius)] border px-3 py-2.5 text-left text-sm transition-colors',
                                checked
                                  ? 'border-[var(--store-primary)] bg-[rgb(var(--store-primary-rgb)/0.08)]'
                                  : 'border-[rgb(var(--store-text-rgb)/0.12)] hover:bg-[rgb(var(--store-text-rgb)/0.04)]',
                              )}
                            >
                              <span className="flex items-center gap-2">
                                <span
                                  aria-hidden="true"
                                  className={cn(
                                    'flex size-5 items-center justify-center rounded-full border',
                                    checked
                                      ? 'border-[var(--store-primary)] bg-[var(--store-primary)] text-white'
                                      : 'border-[rgb(var(--store-text-rgb)/0.3)]',
                                  )}
                                >
                                  {checked ? (
                                    <CheckIcon className="size-3.5" />
                                  ) : null}
                                </span>
                                {value.name}
                              </span>
                              {Number(value.price_delta) !== 0 ? (
                                <span className="text-xs text-[rgb(var(--store-text-rgb)/0.7)]">
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

            <div className="flex items-center gap-3 border-t border-[rgb(var(--store-text-rgb)/0.1)] p-4">
              <div className="flex items-center rounded-[var(--store-button-radius)] border border-[rgb(var(--store-text-rgb)/0.15)]">
                <button
                  type="button"
                  aria-label="Quitar uno"
                  onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  className="flex size-10 items-center justify-center"
                >
                  <MinusIcon aria-hidden="true" className="size-4" />
                </button>
                <span
                  aria-live="polite"
                  className="w-8 text-center text-sm font-semibold tabular-nums"
                >
                  {quantity}
                </span>
                <button
                  type="button"
                  aria-label="Agregar uno"
                  onClick={() =>
                    setQuantity((value) => Math.min(50, value + 1))
                  }
                  className="flex size-10 items-center justify-center"
                >
                  <PlusIcon aria-hidden="true" className="size-4" />
                </button>
              </div>
              <motion.div
                className="flex-1"
                whileTap={reduceMotion ? undefined : { scale: 0.96 }}
              >
                <Button
                  type="button"
                  onClick={submit}
                  className="h-12 w-full rounded-[var(--store-button-radius)] bg-[var(--store-primary)] text-base text-white hover:bg-[var(--store-primary)]/90"
                >
                  Agregar · {formatCOP(lineTotal)}
                </Button>
              </motion.div>
            </div>
          </>
        ) : null}
      </DrawerContent>
    </Drawer>
  )
}
