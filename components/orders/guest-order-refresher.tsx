'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface GuestOrderRefresherProps {
  /** Poll while true; the page passes false once the order is terminal. */
  active: boolean
  intervalMs?: number
}

/**
 * Anonymous guests cannot subscribe to realtime, so the tracking page
 * re-renders on the server every few seconds instead. Polling pauses while the
 * tab is hidden and catches up as soon as it is visible.
 *
 * The tradeoff: `orders` has no SELECT policy for the `anon` role — the page
 * reads the row with the service key after checking the httpOnly ownership
 * cookie — and a realtime subscription is authorised by RLS, not by that
 * cookie. Giving guests live updates would mean either loosening the table's
 * policy for anonymous readers or inventing a broadcast authorisation path;
 * both are a real security surface for a few seconds of latency. So the poll
 * stays, tightened from 15s to 5s while the tab is visible: a table guest is
 * looking at the screen, waiting, and hidden tabs still cost nothing.
 */
export function GuestOrderRefresher({
  active,
  intervalMs = 5_000,
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
