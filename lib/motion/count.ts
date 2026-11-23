// Frames and formatting for <CountUp />. Pure: no React, no DOM, so the
// arithmetic is tested on its own and the component only schedules frames.
import { formatCOP } from '@/lib/format'

export type CountFormat = 'integer' | 'decimal' | 'cop'

/** Fast start, soft landing: the number reads as settling, not braking. */
export function easeOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t))
  return 1 - (1 - clamped) ** 3
}

/**
 * The value to paint `elapsed` ms into a count from `from` to `to`. The last
 * frame is exactly `to`, never a float that happens to be close to it.
 */
export function countFrame(
  from: number,
  to: number,
  elapsed: number,
  duration: number,
): { value: number; done: boolean } {
  if (duration <= 0 || elapsed >= duration) return { value: to, done: true }
  const progress = easeOutCubic(Math.max(0, elapsed) / duration)
  return { value: from + (to - from) * progress, done: false }
}

const integerFormatter = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 0,
})

const decimalFormatter = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

export function formatCount(value: number, format: CountFormat): string {
  if (format === 'cop') return formatCOP(value)
  if (format === 'decimal') return decimalFormatter.format(value)
  return integerFormatter.format(Math.round(value))
}
