'use client'

import { MinusIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuantityStepperProps {
  quantity: number
  onDecrement: () => void
  onIncrement: () => void
  /** Product name, woven into the button labels. */
  itemLabel: string
  size?: 'sm' | 'md'
  /**
   * `false` where 1 is the floor rather than a step away from removal — the
   * drawer, for instance, where decrementing past 1 does nothing. The bin
   * icon would promise an action that never happens.
   */
  allowRemove?: boolean
  className?: string
}

const SIZE = {
  sm: { button: 'size-9', icon: 'size-3.5', value: 'w-7 text-sm' },
  md: { button: 'size-11', icon: 'size-4', value: 'w-9 text-base' },
} as const

/**
 * The `− n +` control a product card morphs into. Every target is at least
 * 36px (44px at `md`), the count is announced politely so a screen reader
 * hears the change without moving focus, and dropping to zero shows a bin so
 * the destructive step is never a surprise.
 */
export function QuantityStepper({
  quantity,
  onDecrement,
  onIncrement,
  itemLabel,
  size = 'sm',
  allowRemove = true,
  className,
}: QuantityStepperProps) {
  const scale = SIZE[size]
  const removing = allowRemove && quantity <= 1
  const atFloor = !allowRemove && quantity <= 1

  return (
    <div
      className={cn(
        'shadow-2 inline-flex items-center rounded-[var(--store-button-radius)] bg-[var(--store-primary)] text-[var(--store-on-primary)]',
        className,
      )}
    >
      <button
        type="button"
        onClick={onDecrement}
        disabled={atFloor}
        aria-label={
          removing
            ? `Quitar ${itemLabel} del carrito`
            : `Quitar uno de ${itemLabel}`
        }
        className={cn(
          'flex items-center justify-center rounded-[inherit] transition-colors hover:bg-black/10',
          atFloor && 'cursor-not-allowed opacity-40 hover:bg-transparent',
          scale.button,
        )}
      >
        {removing ? (
          <Trash2Icon aria-hidden="true" className={scale.icon} />
        ) : (
          <MinusIcon aria-hidden="true" className={scale.icon} />
        )}
      </button>
      <span
        aria-live="polite"
        aria-atomic="true"
        className={cn('text-center font-semibold tabular-nums', scale.value)}
      >
        <span className="sr-only">{itemLabel}: </span>
        {quantity}
      </span>
      <button
        type="button"
        onClick={onIncrement}
        aria-label={`Agregar uno de ${itemLabel}`}
        className={cn(
          'flex items-center justify-center rounded-[inherit] transition-colors hover:bg-black/10',
          scale.button,
        )}
      >
        <PlusIcon aria-hidden="true" className={scale.icon} />
      </button>
    </div>
  )
}
