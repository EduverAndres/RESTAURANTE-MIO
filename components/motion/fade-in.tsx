import { Reveal } from '@/components/motion/reveal'

interface FadeInProps {
  children: React.ReactNode
  className?: string
  /** Kept for existing callers; the scroll position drives the timing now. */
  delay?: number
  /** Kept for existing callers; every FadeIn reveals on scroll now. */
  inView?: boolean
}

/**
 * @deprecated Use `Reveal`. Kept so existing imports keep working.
 *
 * It used to be a Motion component whose server HTML carried
 * `opacity: 0` until JavaScript hydrated it: without JS, or before the bundle
 * arrived, the content was invisible. It now renders a `Reveal`, which is at
 * full opacity in the HTML and only animates in CSS where that is allowed.
 */
export function FadeIn({ children, className }: FadeInProps) {
  return <Reveal className={className}>{children}</Reveal>
}
