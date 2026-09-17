'use client'

import { motion } from 'framer-motion'

interface FadeInProps {
  children: React.ReactNode
  className?: string
  /** Delay in seconds, useful for staggering lists. */
  delay?: number
  /** Animate when scrolled into view instead of on mount. */
  inView?: boolean
}

export function FadeIn({
  children,
  className,
  delay = 0,
  inView = false,
}: FadeInProps) {
  // `initial` must not depend on a browser-only value: useReducedMotion()
  // reads matchMedia, which the server cannot see, so branching here made the
  // server and client render different inline styles and React reported a
  // hydration mismatch on every page using this component. The preference is
  // honoured by <MotionConfig reducedMotion="user"> at the root instead, which
  // drops the movement while keeping the markup identical on both sides.
  const hidden = { opacity: 0, y: 16 }
  const visible = { opacity: 1, y: 0 }

  return (
    <motion.div
      className={className}
      initial={hidden}
      {...(inView
        ? { whileInView: visible, viewport: { once: true, margin: '-10% 0px' } }
        : { animate: visible })}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
