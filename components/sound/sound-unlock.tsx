'use client'

import { useEffect } from 'react'
import { unlockAudio } from '@/lib/sound/player'

const UNLOCK_EVENTS = ['pointerdown', 'keydown'] as const

/**
 * Unlocks the shared audio context on the first gesture anywhere on the page.
 *
 * Browsers refuse to start audio without a user gesture, and a realtime event
 * is never one. Resuming the context on the first tap or key press means the
 * tone for a status change that lands minutes later can still play. Renders
 * nothing; mounted once in the root layout.
 */
export function SoundUnlock() {
  useEffect(() => {
    const unlock = () => {
      unlockAudio()
      for (const type of UNLOCK_EVENTS) {
        window.removeEventListener(type, unlock)
      }
    }
    for (const type of UNLOCK_EVENTS) {
      window.addEventListener(type, unlock, { once: true, passive: true })
    }
    return () => {
      for (const type of UNLOCK_EVENTS) {
        window.removeEventListener(type, unlock)
      }
    }
  }, [])

  return null
}
