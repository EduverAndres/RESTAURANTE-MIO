// In-app notification vocabulary. Pure, safe on client and server.
//
// MIRRORED IN SQL: the check on `notifications.kind`
// (supabase/migrations/20261125000100_notifications.sql) embeds this list
// between `codegen:` markers; tests/notifications.test.ts compares.

export const NOTIFICATION_KINDS = [
  // To admins: something waits for a decision.
  'ad_requested',
  'company_registered',
  'courier_submitted',
  'store_registered',
  // To store owners.
  'ad_reviewed',
  'store_reviewed',
  'payout',
  'reservation_new',
  'reservation_cancelled',
  // To couriers.
  'courier_reviewed',
  'courier_payout',
  // To company admins.
  'company_reviewed',
  'company_member_joined',
  'company_statement',
  // To customers.
  'reservation_updated',
] as const

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]

/** Kinds that ask an admin to act: shown with an accent in the bell. */
export const ACTION_REQUIRED_KINDS: readonly NotificationKind[] = [
  'ad_requested',
  'company_registered',
  'courier_submitted',
  'store_registered',
  'reservation_new',
]

/** A notification as it is stored and shown. */
export interface NotificationMessage {
  kind: NotificationKind
  title: string
  body: string
  /** In-app path, starting with "/". */
  url: string
}
