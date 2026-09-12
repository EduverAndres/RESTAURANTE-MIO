// How old is too old, per Kanban column. Pure module: no React, no Supabase.
//
// In a kitchen nobody reads a number. The board therefore encodes waiting time
// as colour — calm, amber, red — and the number stays as the detail you read
// once the colour has already caught your eye.
import type { ActiveOrderStatus } from '@/lib/orders/kanban'
import type { OrderStatus } from '@/types/app'

export type ElapsedTone = 'fresh' | 'warn' | 'late'

export interface ToneThresholds {
  /** Minutes since the order was placed at which the card turns amber. */
  warn: number
  /** Minutes at which it turns red. */
  late: number
}

/**
 * Measured from `created_at`, not from the moment the order entered the
 * column, because that is the only timestamp the board carries — and it is
 * also the number the customer is watching. The budgets are cumulative: an
 * order still unanswered after eight minutes is an emergency, while an order
 * that has been cooking for twenty is simply being cooked.
 */
export const ELAPSED_THRESHOLDS: Record<ActiveOrderStatus, ToneThresholds> = {
  pending: { warn: 3, late: 8 },
  accepted: { warn: 8, late: 15 },
  preparing: { warn: 20, late: 35 },
  ready: { warn: 25, late: 40 },
  picked_up: { warn: 40, late: 60 },
}

export const ELAPSED_TONE_LABELS: Record<ElapsedTone, string> = {
  fresh: 'En tiempo',
  warn: 'Va justo',
  late: 'Con retraso',
}

export function elapsedTone(
  minutes: number,
  thresholds: ToneThresholds,
): ElapsedTone {
  if (minutes >= thresholds.late) return 'late'
  if (minutes >= thresholds.warn) return 'warn'
  return 'fresh'
}

function thresholdsFor(status: OrderStatus): ToneThresholds | null {
  return status in ELAPSED_THRESHOLDS
    ? ELAPSED_THRESHOLDS[status as ActiveOrderStatus]
    : null
}

/** Tone for one board card. Terminal statuses have no clock, so they are calm. */
export function orderElapsedTone(
  status: OrderStatus,
  createdAt: string,
  now: Date,
): ElapsedTone {
  const thresholds = thresholdsFor(status)
  if (!thresholds) return 'fresh'
  const minutes = (now.getTime() - new Date(createdAt).getTime()) / 60_000
  return elapsedTone(minutes, thresholds)
}
