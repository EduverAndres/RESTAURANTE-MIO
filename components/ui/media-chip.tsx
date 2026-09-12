import { cn } from '@/lib/utils'

interface MediaChipProps {
  /** Decorative glyph; the text beside it carries the meaning. */
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
  /**
   * `solid` is the default and is legible over any photograph. `dark` is for
   * a chip that sits on a light area of the image and needs to recede.
   */
  tone?: 'solid' | 'dark'
}

/**
 * A small fact stated on top of an image: a time, a fee, a badge. Opaque
 * enough to keep 4.5:1 whatever the photo underneath is doing, which is why
 * it is a card-coloured pill and not a translucent white one.
 */
export function MediaChip({
  icon,
  children,
  className,
  tone = 'solid',
}: MediaChipProps) {
  return (
    <span
      className={cn(
        'rounded-pill shadow-1 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium tabular-nums backdrop-blur-sm',
        tone === 'solid'
          ? 'bg-card/95 text-foreground'
          : 'bg-foreground/80 text-background',
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}
