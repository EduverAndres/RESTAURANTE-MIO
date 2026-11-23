'use client'

import { useEffect, useRef, useState } from 'react'
import { motionReducedNow } from '@/components/motion/motion-preference'
import { countFrame, formatCount, type CountFormat } from '@/lib/motion/count'
import { cn } from '@/lib/utils'

interface CountUpProps {
  value: number
  format?: CountFormat
  /** Length of the first count, from 0, in ms. Later changes are quicker. */
  duration?: number
  className?: string
}

/** A change after the first count (a slider moving) should not lag behind. */
const UPDATE_MS = 450

/**
 * A number that counts up to its value the first time it scrolls into view.
 *
 * - The server HTML carries the final value, so it is right without
 *   JavaScript and for search engines.
 * - Assistive technology only ever reads the final value: it sits in a
 *   visually hidden span, and the animated digits are `aria-hidden`. (An
 *   `aria-label` on a plain span is not allowed by ARIA, and axe flags it.)
 * - It only animates after mounting, only if both reduced-motion signals
 *   allow it, and only when it starts off screen: a number someone is already
 *   looking at is never reset to 0 in front of them.
 * - When `value` changes later (a calculator), it glides from what is shown
 *   to the new value, or jumps there with reduced motion.
 */
export function CountUp({
  value,
  format = 'integer',
  duration = 1200,
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(value)
  const shownRef = useRef(value)
  const targetRef = useRef(value)
  const previousRef = useRef(value)
  const frameRef = useRef(0)
  const waitingRef = useRef(false)

  // First count: arm only when off screen, start on entry.
  useEffect(() => {
    const node = ref.current
    if (!node || motionReducedNow()) return
    if (typeof IntersectionObserver === 'undefined') return
    const rect = node.getBoundingClientRect()
    if (rect.top < window.innerHeight && rect.bottom > 0) return

    const paint = (next: number) => {
      shownRef.current = next
      setShown(next)
    }

    waitingRef.current = true
    paint(0)
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        waitingRef.current = false
        const target = targetRef.current
        const start = performance.now()
        const tick = (now: number) => {
          const frame = countFrame(0, target, now - start, duration)
          paint(frame.value)
          if (!frame.done) frameRef.current = requestAnimationFrame(tick)
        }
        frameRef.current = requestAnimationFrame(tick)
      },
      { threshold: 0.5 },
    )
    observer.observe(node)

    return () => {
      observer.disconnect()
      cancelAnimationFrame(frameRef.current)
      if (waitingRef.current) {
        waitingRef.current = false
        paint(targetRef.current)
      }
    }
  }, [duration])

  // Later changes: glide from what is on screen to the new value.
  useEffect(() => {
    if (previousRef.current === value) return
    previousRef.current = value
    targetRef.current = value
    // Still waiting for its first count: that count will use the new target.
    if (waitingRef.current) return

    cancelAnimationFrame(frameRef.current)
    const paint = (next: number) => {
      shownRef.current = next
      setShown(next)
    }
    if (motionReducedNow()) {
      paint(value)
      return
    }
    const from = shownRef.current
    const start = performance.now()
    const tick = (now: number) => {
      const frame = countFrame(from, value, now - start, UPDATE_MS)
      paint(frame.value)
      if (!frame.done) frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [value])

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      <span className="sr-only">{formatCount(value, format)}</span>
      <span aria-hidden="true">{formatCount(shown, format)}</span>
    </span>
  )
}
