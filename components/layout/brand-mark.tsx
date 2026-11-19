import { cn } from '@/lib/utils'

/**
 * The platform's symbol: a shop awning and the wordmark's dot. Drawn on a
 * 64-unit grid so it holds up from a 20px favicon to the centre of a QR
 * code; `public/icon.svg` is the same drawing at 512 units for the PWA icons.
 *
 * Painted with the brand tokens, so the dark ramp gets the dark variant
 * (bright orange with an ink awning) without a second component.
 */
export function BrandMark({
  className,
  title,
}: {
  className?: string
  /** Accessible name; leave empty when the mark sits next to the brand name. */
  title?: string
}) {
  return (
    <svg
      data-slot="brand-mark"
      viewBox="0 0 64 64"
      className={cn('shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect width="64" height="64" rx="15" fill="var(--primary)" />
      <path
        d="M11 15 H53 V26 a7 7 0 0 1 -14 0 a7 7 0 0 1 -14 0 a7 7 0 0 1 -14 0 Z"
        fill="var(--primary-foreground)"
      />
      <circle cx="32" cy="44" r="6" fill="var(--primary-foreground)" />
    </svg>
  )
}
