'use client'

import { useEffect } from 'react'
import { env } from '@/lib/env'

const ENABLE_SW =
  process.env.NODE_ENV === 'production' || env.NEXT_PUBLIC_ENABLE_SW

/** Registers public/sw.js once on mount. Renders nothing. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!ENABLE_SW) return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Failed to register the service worker', error)
    })
  }, [])

  return null
}
