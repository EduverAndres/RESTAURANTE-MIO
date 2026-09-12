'use client'

import { motion, useReducedMotion } from 'framer-motion'

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
  const reduceMotion = useReducedMotion()
  const hidden = reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }
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
