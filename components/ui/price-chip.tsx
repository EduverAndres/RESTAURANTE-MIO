import { formatCOP } from '@/lib/format'
import { cn } from '@/lib/utils'

interface PriceChipProps {
  amount: number
  className?: string
  /** Visual size; "lg" is meant for product cards, "sm" for dense lists. */
  size?: 'sm' | 'lg'
}

export function PriceChip({ amount, className, size = 'lg' }: PriceChipProps) {
  return (
    <span
      className={cn(
        'rounded-pill bg-card/95 text-foreground shadow-soft ring-foreground/10 inline-flex items-center font-medium tabular-nums ring-1 backdrop-blur-sm',
        size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs',
        className,
      )}
    >
      {formatCOP(amount)}
    </span>
  )
}
