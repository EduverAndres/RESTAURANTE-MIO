'use client'

import { MotionConfig } from 'framer-motion'
import { useSyncExternalStore } from 'react'
import {
  appMotionReduced,
  subscribeAppMotion,
} from '@/components/motion/motion-preference'

type ReducedMotion = 'always' | 'user'

function snapshot(): ReducedMotion {
  return appMotionReduced() ? 'always' : 'user'
}

/** The server cannot see either preference; Motion's own default is "user". */
function serverSnapshot(): ReducedMotion {
  return 'user'
}

/**
 * Motion's reduced-motion policy for the whole app.
 *
 * "user" makes Motion honour the system's `prefers-reduced-motion`; that alone
 * ignored the app's "Reducir animaciones", which only exists as
 * `<html data-motion="reduce">`. When that attribute is present this switches
 * to "always", so transform and layout animations stop for that person too.
 *
 * `useSyncExternalStore` keeps the server and the hydrating client on the same
 * value ("user") and then follows the attribute live; components never branch
 * on a browser-only value while rendering. MotionConfig paints no markup, so
 * the switch cannot cause a hydration mismatch either.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const reducedMotion = useSyncExternalStore(
    subscribeAppMotion,
    snapshot,
    serverSnapshot,
  )
  return <MotionConfig reducedMotion={reducedMotion}>{children}</MotionConfig>
}
