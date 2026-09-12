'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  deletePushSubscription,
  savePushSubscription,
} from '@/app/(protected)/account/push-actions'
import { urlBase64ToUint8Array } from '@/lib/push/keys'

export type PushSubscriptionState =
  | 'unsupported'
  | 'checking'
  | 'subscribed'
  | 'unsubscribed'
  | 'denied'

const GENERIC_ERROR = 'No pudimos actualizar las notificaciones. Inténtalo de nuevo.'

function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/**
 * Drives the browser subscribe/unsubscribe flow for web push. Persists the
 * subscription with the server actions in `push-actions.ts`; the caller only
 * renders `state`/`pending`/`error` and calls `subscribe`/`unsubscribe`.
 *
 * `state` always starts at `checking` (even though the server render already
 * knows it has no browser) so the first client render matches the server
 * markup; the real support check only runs in an effect, after hydration.
 */
export function usePushSubscription() {
  const [state, setState] = useState<PushSubscriptionState>('checking')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!pushSupported()) {
      setState('unsupported')
      return
    }
    let cancelled = false
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (!cancelled) setState(subscription ? 'subscribed' : 'unsubscribed')
      })
      .catch(() => {
        if (!cancelled) setState('unsubscribed')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const subscribe = useCallback(async () => {
    if (!pushSupported()) return
    setPending(true)
    setError(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState('denied')
        return
      }
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) {
        setError(GENERIC_ERROR)
        return
      }
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      })
      const json = subscription.toJSON()
      const result = await savePushSubscription({
        endpoint: json.endpoint ?? '',
        keys: {
          p256dh: json.keys?.p256dh ?? '',
          auth: json.keys?.auth ?? '',
        },
      })
      if (!result.ok) {
        setError(result.error)
        await subscription.unsubscribe()
        setState('unsubscribed')
        return
      }
      setState('subscribed')
    } catch (subscribeError) {
      console.error('Failed to subscribe to push notifications', subscribeError)
      setError(GENERIC_ERROR)
    } finally {
      setPending(false)
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    if (!pushSupported()) return
    setPending(true)
    setError(null)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        const endpoint = subscription.endpoint
        await subscription.unsubscribe()
        const result = await deletePushSubscription({ endpoint })
        if (!result.ok) setError(result.error)
      }
      setState('unsubscribed')
    } catch (unsubscribeError) {
      console.error(
        'Failed to unsubscribe from push notifications',
        unsubscribeError,
      )
      setError(GENERIC_ERROR)
    } finally {
      setPending(false)
    }
  }, [])

  return { state, pending, error, subscribe, unsubscribe }
}
