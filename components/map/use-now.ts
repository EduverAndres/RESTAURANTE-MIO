'use client'

import { useEffect, useState } from 'react'

/**
 * A clock that ticks once a second while `enabled`. The live maps derive
 * ETA and signal freshness from it, so a page left open keeps telling the
 * truth instead of freezing at the last fix.
 */
export function useNow(enabled: boolean): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!enabled) return
    const interval = window.setInterval(() => setNow(new Date()), 1_000)
    return () => window.clearInterval(interval)
  }, [enabled])
  return now
}
