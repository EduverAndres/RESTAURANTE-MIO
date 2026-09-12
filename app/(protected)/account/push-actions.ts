'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import {
  deletePushSubscriptionSchema,
  pushSubscriptionSchema,
  type DeletePushSubscriptionInput,
  type PushSubscriptionInput,
} from '@/lib/validations/push'

export type PushActionResult = { ok: true } | { ok: false; error: string }

const SESSION_EXPIRED = 'Tu sesión expiró. Inicia sesión de nuevo.'

/**
 * Upserts the caller's push subscription. The endpoint is globally unique,
 * so re-subscribing (a new browser, a refreshed key) is idempotent.
 */
export async function savePushSubscription(
  input: PushSubscriptionInput,
): Promise<PushActionResult> {
  const parsed = pushSubscriptionSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Suscripción inválida.',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: SESSION_EXPIRED }

  const requestHeaders = await headers()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      user_agent: requestHeaders.get('user-agent'),
    },
    { onConflict: 'endpoint' },
  )
  if (error) {
    console.error('Failed to save push subscription', error)
    return {
      ok: false,
      error: 'No pudimos activar las notificaciones. Inténtalo de nuevo.',
    }
  }

  return { ok: true }
}

/** Removes the caller's subscription, e.g. after the browser unsubscribes. */
export async function deletePushSubscription(
  input: DeletePushSubscriptionInput,
): Promise<PushActionResult> {
  const parsed = deletePushSubscriptionSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Suscripción inválida.',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: SESSION_EXPIRED }

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', parsed.data.endpoint)
  if (error) {
    console.error('Failed to delete push subscription', error)
    return {
      ok: false,
      error: 'No pudimos desactivar las notificaciones. Inténtalo de nuevo.',
    }
  }

  return { ok: true }
}
