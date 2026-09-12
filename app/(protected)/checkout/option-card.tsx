'use client'

import { CheckIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OptionCardProps {
  checked: boolean
  onSelect: () => void
  /** Optional leading mark: an icon tile, a payment logo, a glyph. */
  leading?: React.ReactNode
  title: React.ReactNode
  hint?: React.ReactNode
  /** Rendered on the right, before the tick. */
  trailing?: React.ReactNode
  className?: string
}

/**
 * The checkout's one selectable card.
 *
 * Delivery type, address, timing and payment method are all the same
 * interaction — pick one of these — so they are the same control. It is a
 * real `radio`, not a styled div, and it states its selection twice: with the
 * brand ring and with a tick, because colour alone is not an affordance.
 */
export function OptionCard({
  checked,
  onSelect,
  leading,
  title,
  hint,
  trailing,
  className,
}: OptionCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        'rounded-card flex min-h-14 w-full items-center gap-3 border p-3 text-left transition-colors',
        checked
          ? 'border-primary bg-primary/6 ring-primary ring-1'
          : 'border-border hover:border-foreground/30 hover:bg-muted/50',
        className,
      )}
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        {hint ? (
          <span className="text-muted-foreground block text-xs">{hint}</span>
        ) : null}
      </span>
      {trailing}
      <span
        aria-hidden="true"
        className={cn(
          'grid size-5 shrink-0 place-items-center rounded-full border transition-colors',
          checked
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-input',
        )}
      >
        {checked ? <CheckIcon className="size-3" /> : null}
      </span>
    </button>
  )
}
