'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface GuestOrderRefresherProps {
  /** Poll while true; the page passes false once the order is terminal. */
  active: boolean
  intervalMs?: number
}

/**
 * Anonymous guests cannot subscribe to realtime (no SELECT policy), so the
 * tracking page re-renders on the server every few seconds instead. Polling
 * pauses while the tab is hidden and catches up as soon as it is visible.
 */
export function GuestOrderRefresher({
  active,
  intervalMs = 15_000,
}: GuestOrderRefresherProps) {
  const router = useRouter()

  useEffect(() => {
    if (!active) return
    const refreshIfVisible = () => {
      if (document.visibilityState === 'hidden') return
      router.refresh()
    }
    const id = window.setInterval(refreshIfVisible, intervalMs)
    document.addEventListener('visibilitychange', refreshIfVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', refreshIfVisible)
    }
  }, [active, intervalMs, router])

  return null
}
