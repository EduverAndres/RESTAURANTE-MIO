import 'server-only'

import webpush from 'web-push'
import { pushConfigured, serverEnv } from '@/lib/env.server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PushPayload } from '@/lib/push/messages'

// Fire-and-forget web push delivery. Every export here is meant to be
// called from `after()` inside a server action: a push failure must never
// change the action's result, so every error is logged and swallowed.

let vapidConfigured = false

function ensureVapidConfigured() {
  if (vapidConfigured) return
  webpush.setVapidDetails(
    serverEnv.VAPID_SUBJECT as string,
    serverEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
    serverEnv.VAPID_PRIVATE_KEY as string,
  )
  vapidConfigured = true
}

/**
 * Sends `payload` to every subscription of the given users. Stale
 * subscriptions (404/410 from the push service, meaning the browser dropped
 * them) are pruned; any other failure is logged and ignored. No-op when
 * push is not configured or there is nothing to send.
 */
export async function sendPushToUsers(
  userIds: readonly string[],
  payload: PushPayload,
): Promise<void> {
  if (!pushConfigured() || userIds.length === 0) return

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (error) {
    console.error('Admin client unavailable for push', error)
    return
  }

  const { data: subscriptions, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', userIds as string[])
  if (error) {
    console.error('Failed to load push subscriptions', error)
    return
  }
  if (!subscriptions || subscriptions.length === 0) return

  ensureVapidConfigured()

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(payload),
        )
      } catch (sendError) {
        const statusCode = (sendError as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          const { error: deleteError } = await admin
            .from('push_subscriptions')
            .delete()
            .eq('id', subscription.id)
          if (deleteError) {
            console.error('Failed to prune stale push subscription', deleteError)
          }
          return
        }
        console.error('Failed to send push notification', sendError)
      }
    }),
  )
}

/**
 * Notifies the owner of `storeId` about a freshly placed order. The owner
 * lookup happens here (with the service role) so checkout actions never
 * need to know about `stores.owner_id`.
 */
export async function sendPushToStoreOwner(
  storeId: string,
  payload: PushPayload,
): Promise<void> {
  if (!pushConfigured()) return

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (error) {
    console.error('Admin client unavailable for push', error)
    return
  }

  const { data: store, error } = await admin
    .from('stores')
    .select('owner_id')
    .eq('id', storeId)
    .maybeSingle()
  if (error) {
    console.error('Failed to look up store owner for push', error)
    return
  }
  if (!store) return

  await sendPushToUsers([store.owner_id], payload)
}
