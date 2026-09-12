// The ETA clock on the customer's tracking screen. Pure module: the ticking
// lives in the component, the arithmetic lives here so it can be tested
// without a fake timer.

export interface Countdown {
  totalSeconds: number
  minutes: number
  seconds: number
  /** The estimate has already passed; the order is due about now. */
  past: boolean
}

const DUE_LABEL = 'Llegando'

/**
 * Time left until `target`, floored to the second so the clock never shows a
 * minute it has not reached yet. Returns `null` when there is no usable
 * estimate, which is the caller's cue to hide the whole countdown rather than
 * render a zero.
 */
export function countdownTo(
  target: string | Date | null | undefined,
  now: Date,
): Countdown | null {
  if (!target) return null
  const time = target instanceof Date ? target.getTime() : Date.parse(target)
  if (Number.isNaN(time)) return null

  const totalSeconds = Math.floor((time - now.getTime()) / 1000)
  if (totalSeconds <= 0) {
    return { totalSeconds: 0, minutes: 0, seconds: 0, past: true }
  }
  return {
    totalSeconds,
    minutes: Math.floor(totalSeconds / 60),
    seconds: totalSeconds % 60,
    past: false,
  }
}

/** `12:05`, or a word once the estimate has passed. Never `0:00`. */
export function countdownLabel(countdown: Countdown): string {
  if (countdown.past) return DUE_LABEL
  return `${countdown.minutes}:${String(countdown.seconds).padStart(2, '0')}`
}
