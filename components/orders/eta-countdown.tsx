'use client'

import { useEffect, useState } from 'react'
import { countdownLabel, countdownTo } from '@/lib/orders/countdown'
import { cn } from '@/lib/utils'

const timeFormatter = new Intl.DateTimeFormat('es-CO', {
  hour: '2-digit',
  minute: '2-digit',
})

interface EtaCountdownProps {
  /** ISO timestamp of the estimate. */
  target: string | null
  /** "Llega" for a delivery, "Listo" for a pickup. */
  verb: string
  className?: string
}

/**
 * The clock on the tracking screen.
 *
 * A time of day ("llega a las 19:40") makes you do arithmetic; a countdown
 * does it for you, which is why it is the number set large. The wall-clock
 * time stays underneath for the people who are planning around it.
 *
 * It ticks every second but is not a live region: a screen reader announcing
 * a new number sixty times a minute would make the page unusable. The label
 * below carries the same information as static text.
 */
export function EtaCountdown({ target, verb, className }: EtaCountdownProps) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    // Starting at `null` keeps the server and the first client render
    // identical; the clock appears on the first tick.
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  if (!target) return null
  const countdown = now ? countdownTo(target, now) : null
  const at = new Date(target)

  return (
    <div className={cn('space-y-0.5', className)}>
      <p
        aria-hidden="true"
        className="font-display text-4xl leading-none font-semibold tabular-nums sm:text-5xl"
      >
        {countdown ? countdownLabel(countdown) : '—'}
      </p>
      <p className="text-sm">
        {countdown?.past
          ? `${verb} de un momento a otro`
          : `${verb} alrededor de las ${timeFormatter.format(at)}`}
      </p>
    </div>
  )
}
