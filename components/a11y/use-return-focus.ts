'use client'

import { useEffect, useRef } from 'react'

/**
 * Returns focus to whatever opened an overlay, once it closes.
 *
 * Radix and vaul already do this for an overlay opened through their own
 * `Trigger`: they remember the element that had focus and restore it on
 * unmount. The cart sheet has no trigger — its open state lives in the cart
 * store and three different controls set it — so there was nothing for Radix
 * to restore to and focus fell back to `<body>`, dropping a keyboard user at
 * the top of the document every time they closed the cart.
 *
 * Pair it with `onCloseAutoFocus={(event) => event.preventDefault()}` on the
 * content, so only one of the two mechanisms moves focus.
 */
export function useReturnFocus(open: boolean): void {
  const opener = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) {
      const active = document.activeElement
      if (active instanceof HTMLElement && active !== document.body) {
        opener.current = active
      }
      return
    }

    const target = opener.current
    opener.current = null
    // `isConnected` guards the case where the opener was itself inside
    // something that has since unmounted (adding from the product drawer,
    // which closes as the cart opens).
    if (!target?.isConnected) return
    // One frame later: the overlay is still unmounting on this one.
    const frame = requestAnimationFrame(() =>
      target.focus({ preventScroll: true }),
    )
    return () => cancelAnimationFrame(frame)
  }, [open])
}
