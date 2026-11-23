'use client'

import { useSyncExternalStore } from 'react'

function subscribe(): () => void {
  return () => {}
}

/**
 * `false` on the server and while hydrating, `true` from then on (and right
 * away after a client-side navigation). For markup that has to be complete
 * without JavaScript — every tab panel visible — and can tidy itself up once
 * the interactive version is actually running.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
}
