// How many times a courier may mistype the handover code before the code
// stops being checked at all. Four digits leave 10,000 possibilities, so
// without a cap a courier could simply try them all through the action.
//
// Pure: the action reads the row, asks this module what happened, and
// writes the counters back. A lock never expires on its own; only the
// customer ("Ya lo recibí") or the merchant (dashboard) can close the order
// after that, which is exactly the point.

export const MAX_DELIVERY_CODE_ATTEMPTS = 5

export interface DeliveryAttemptInput {
  /** Wrong attempts stored so far. */
  attempts: number
  /** When the code was locked, or null while it can still be tried. */
  lockedAt: string | null
  /** Whether the entered code matched the issued one. */
  matches: boolean
  now: Date
}

export type DeliveryAttemptOutcome =
  | { kind: 'ok' }
  | { kind: 'mismatch'; attempts: number; locked: boolean }
  | { kind: 'locked' }

/**
 * Decides what a delivery attempt means. A locked code stays locked whatever
 * was typed; a mismatch bumps the counter and locks once it reaches the cap.
 * `now` is accepted for symmetry with the row (and future expiry rules) but
 * plays no part: locks are permanent.
 */
export function deliveryAttemptOutcome({
  attempts,
  lockedAt,
  matches,
}: DeliveryAttemptInput): DeliveryAttemptOutcome {
  if (lockedAt !== null) return { kind: 'locked' }
  if (matches) return { kind: 'ok' }
  const next = attempts + 1
  return {
    kind: 'mismatch',
    attempts: next,
    locked: next >= MAX_DELIVERY_CODE_ATTEMPTS,
  }
}
