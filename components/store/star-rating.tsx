import { StarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  /** 0..5; fractions fill the last star partially. */
  value: number
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Stars are decoration; the rating itself is text for anyone not looking at
 * them. `role="img"` plus a label means a screen reader says "4,5 de 5" once
 * instead of reading five identical icons.
 */
export function StarRating({ value, size = 'sm', className }: StarRatingProps) {
  const clamped = Math.max(0, Math.min(5, value))
  const iconSize = size === 'sm' ? 'size-3.5' : 'size-5'

  return (
    <span
      role="img"
      aria-label={`${clamped.toFixed(1).replace('.', ',')} de 5 estrellas`}
      className={cn('inline-flex items-center gap-0.5', className)}
    >
      {Array.from({ length: 5 }, (_, index) => {
        const fill = Math.max(0, Math.min(1, clamped - index))
        return (
          <span key={index} className="relative inline-flex">
            <StarIcon
              aria-hidden="true"
              className={cn(iconSize, 'text-[rgb(var(--store-text-rgb)/0.2)]')}
            />
            {fill > 0 ? (
              <span
                aria-hidden="true"
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <StarIcon
                  className={cn(
                    iconSize,
                    'fill-[var(--store-accent)] text-[var(--store-accent)]',
                  )}
                />
              </span>
            ) : null}
          </span>
        )
      })}
    </span>
  )
}
