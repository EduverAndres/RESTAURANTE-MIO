import { cn } from '@/lib/utils'

type RevealTag =
  | 'div'
  | 'section'
  | 'header'
  | 'article'
  | 'aside'
  | 'figure'
  | 'ul'
  | 'ol'
  | 'li'
  | 'p'

interface RevealProps extends React.HTMLAttributes<HTMLElement> {
  as?: RevealTag
  /** `line` grows a rule from the left instead of fading a block in. */
  variant?: 'block' | 'line'
}

/**
 * Fades a block in as it scrolls into view, in CSS only.
 *
 * The movement is a scroll-driven animation (`animation-timeline: view()`,
 * see `.reveal` in app/globals.css) that only exists when the browser
 * supports it, the system asks for no reduced motion and the app preference
 * is not "Reducir animaciones". Everywhere else the block is simply there:
 * the server HTML is at full opacity, so it is visible without JavaScript,
 * to search engines and on any browser that cannot animate it.
 *
 * A server component on purpose: there is no state, no observer and nothing
 * to hydrate.
 */
export function Reveal({
  as: Tag = 'div',
  variant = 'block',
  className,
  ...props
}: RevealProps) {
  return (
    <Tag
      className={cn(variant === 'line' ? 'reveal-line' : 'reveal', className)}
      {...props}
    />
  )
}
