import { cn } from '@/lib/utils'

interface MarqueeProps {
  /** `<li>` items. Rendered twice: once for real, once as the loop's tail. */
  children: React.ReactNode
  /** Names the list for assistive technology. */
  label: string
  /** Seconds for one full lap; longer lists want more. */
  duration?: number
  className?: string
  listClassName?: string
}

/**
 * An endless horizontal strip, in CSS only.
 *
 * The list is rendered twice and the track slides by exactly half its width,
 * so the second copy takes the first one's place and the loop has no seam.
 * The copy is `aria-hidden` and `inert`: a screen reader hears the list once
 * and a keyboard never tabs into the duplicate links.
 *
 * It stops on hover and whenever focus is inside, so a link can be read and
 * clicked. With reduced motion — the system's or the app's — there is no
 * animation at all (`animation: none`), the copy disappears and the list
 * simply wraps onto several lines. See `.marquee` in app/globals.css.
 */
export function Marquee({
  children,
  label,
  duration = 40,
  className,
  listClassName,
}: MarqueeProps) {
  return (
    <div
      className={cn('marquee', className)}
      style={{ '--marquee-duration': `${duration}s` } as React.CSSProperties}
    >
      <div className="marquee-track">
        <ul aria-label={label} className={cn('marquee-group', listClassName)}>
          {children}
        </ul>
        <ul
          aria-hidden="true"
          inert
          data-marquee-copy=""
          className={cn('marquee-group', listClassName)}
        >
          {children}
        </ul>
      </div>
    </div>
  )
}
