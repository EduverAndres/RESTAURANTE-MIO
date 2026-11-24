import 'server-only'

import { logger } from '@/lib/log/logger'
import type { OutgoingNotification } from '@/lib/notifications/messages'
import { sendPushToUsers } from '@/lib/push/send'
import { createAdminClient } from '@/lib/supabase/admin'

/** Who a notification is for. */
export type NotificationTarget =
  | { userIds: readonly string[] }
  | { admins: true }
  | { storeOwner: string }
  | { companyAdmins: string }

type Admin = ReturnType<typeof createAdminClient>

async function resolveRecipients(
  admin: Admin,
  target: NotificationTarget,
): Promise<string[]> {
  if ('userIds' in target) return [...new Set(target.userIds)]

  if ('admins' in target) {
    const { data, error } = await admin
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
    if (error) throw error
    return (data ?? []).map((row) => row.id)
  }

  if ('storeOwner' in target) {
    const { data, error } = await admin
      .from('stores')
      .select('owner_id')
      .eq('id', target.storeOwner)
      .maybeSingle()
    if (error) throw error
    return data?.owner_id ? [data.owner_id] : []
  }

  const { data, error } = await admin
    .from('company_members')
    .select('user_id')
    .eq('company_id', target.companyAdmins)
    .eq('role', 'admin')
    .eq('active', true)
  if (error) throw error
  return (data ?? []).map((row) => row.user_id)
}

/**
 * Tells people about an important event, two ways at once: a row in their
 * inbox (`public.notifications`), which the bell receives live through
 * Realtime and which survives a missed push, and a web push for when the
 * app is closed.
 *
 * Best effort by design: it never throws, because the event it reports has
 * already happened. Call it inside `after()` so it never delays the response.
 */
export async function notify(
  target: NotificationTarget,
  message: OutgoingNotification,
): Promise<void> {
  let admin: Admin
  try {
    admin = createAdminClient()
  } catch (error) {
    logger.error('notifications.no_admin_client', { kind: message.kind }, error)
    return
  }

  let recipients: string[]
  try {
    recipients = await resolveRecipients(admin, target)
  } catch (error) {
    logger.error('notifications.resolve_failed', { kind: message.kind }, error)
    return
  }
  if (recipients.length === 0) return

  const { error } = await admin.from('notifications').insert(
    recipients.map((recipientId) => ({
      recipient_id: recipientId,
      kind: message.kind,
      title: message.title,
      body: message.body,
      url: message.url,
    })),
  )
  if (error) {
    // The push below still goes out: the inbox row is a convenience, the
    // person learning about the event is the point.
    logger.error('notifications.insert_failed', { kind: message.kind }, error)
  }

  try {
    await sendPushToUsers(recipients, {
      title: message.title,
      body: message.body,
      url: message.url,
      tag: message.tag,
    })
  } catch (pushError) {
    logger.error('notifications.push_failed', { kind: message.kind }, pushError)
  }
}
