import 'server-only'

import { isRefundable } from '@/lib/refunds/plan'
import {
  classifyUnappliedEvent,
  compareUnappliedEvents,
  isActionableUnappliedReason,
  type UnappliedEventReason,
} from '@/lib/payments/unapplied-events'
import { createClient } from '@/lib/supabase/server'
import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@/types/app'

/**
 * Nobody works through a queue of thousands, and the point of the screen is
 * the handful that need a person. The cap keeps the page bounded; what falls
 * off it is the NEWEST rows, and how many fell off is reported alongside —
 * see `fetchStuckPaymentEvents`. The actionable badge counts only the rows on
 * the page, so it reads "at least this many", which is the honest reading of
 * a capped list.
 */
export const STUCK_EVENTS_LIMIT = 200

export interface StuckPaymentEvent {
  id: string
  provider: string
  gatewayStatus: string
  reference: string
  /** In pesos, converted from the gateway's cents. `null` if none was sent. */
  amount: number | null
  received_at: string
  reason: UnappliedEventReason
  orderId: string | null
  shortCode: string | null
  orderStatus: OrderStatus | null
  paymentMethod: PaymentMethod | null
  paymentStatus: PaymentStatus | null
  total: number | null
  /**
   * Present when this row can be resolved by recording a refund — i.e. the
   * order exists and actually took money. Pre-resolved here so the page does
   * not have to re-derive it from four nullable columns.
   */
  refundable: { orderId: string; shortCode: string; total: number } | null
}

export interface StuckPaymentSnapshot {
  /** At most `STUCK_EVENTS_LIMIT` rows, oldest first before re-sorting. */
  rows: StuckPaymentEvent[]
  /** How many unapplied events exist in total, cap or no cap. */
  total: number
  /** True when `rows` is a partial view of `total`. */
  truncated: boolean
}

/**
 * Gateway events received and never written to their order.
 *
 * ---------------------------------------------------------------------------
 * Why oldest first, and why the total is returned
 * ---------------------------------------------------------------------------
 * The list is capped, so something has to fall off once the backlog is bigger
 * than the cap. Ordering `received_at desc` dropped the OLDEST rows — the
 * ones that have been costing money the longest, and the only ones nobody is
 * about to fix by accident. A charge that arrived two minutes ago is very
 * likely to apply on the gateway's next delivery; one from three weeks ago
 * never will. So the cap now keeps the oldest and drops the newest, which
 * reappear on their own as they age.
 *
 * The count is asked for separately (`count: 'exact'`, which PostgREST
 * answers over the whole filtered set rather than the returned page) so the
 * screen can say how much is really stuck. A truncated list that looks
 * complete is how an operator concludes the backlog is 200 when it is 4000.
 *
 * The `applied_at is null` filter is exactly the partial index
 * `payment_events_unapplied_idx` added by
 * `20260919000200_payment_events_applied_at.sql`, so this stays one index
 * scan however large the table grows — and the index is on `received_at`,
 * which is what makes the ascending order free. The reason is computed with
 * `lib/payments/unapplied-events.ts` — the same rules
 * `scripts/audit-unapplied-events.sql` runs in psql.
 *
 * Read under the caller's RLS: `payment_events` grants only `is_admin()`.
 */
export async function fetchStuckPaymentEvents(): Promise<StuckPaymentSnapshot> {
  const supabase = await createClient()
  const { data, count } = await supabase
    .from('payment_events')
    .select(
      'id, provider, status, reference, amount_in_cents, received_at, orders(id, short_code, status, payment_method, payment_status, total)',
      { count: 'exact' },
    )
    .is('applied_at', null)
    .order('received_at', { ascending: true })
    .limit(STUCK_EVENTS_LIMIT)

  const rows = (data ?? [])
    .map((event) => {
      const order = event.orders
        ? {
            payment_status: event.orders.payment_status,
            total: Number(event.orders.total),
          }
        : null
      return {
        id: event.id,
        provider: event.provider,
        gatewayStatus: event.status,
        reference: event.reference,
        amount:
          event.amount_in_cents === null ? null : event.amount_in_cents / 100,
        received_at: event.received_at,
        reason: classifyUnappliedEvent({
          gateway_status: event.status,
          amount_in_cents: event.amount_in_cents,
          order,
        }),
        orderId: event.orders?.id ?? null,
        shortCode: event.orders?.short_code ?? null,
        orderStatus: event.orders?.status ?? null,
        paymentMethod: event.orders?.payment_method ?? null,
        paymentStatus: order?.payment_status ?? null,
        total: order?.total ?? null,
        refundable:
          event.orders && isRefundable(event.orders)
            ? {
                orderId: event.orders.id,
                shortCode: event.orders.short_code,
                total: Number(event.orders.total),
              }
            : null,
      }
    })
    .sort(compareUnappliedEvents)

  // `count` is null only when the database did not answer one; the rows we
  // did get are then the floor, which is still better than claiming zero.
  const total = count ?? rows.length
  return { rows, total, truncated: total > rows.length }
}

/** How many of those rows need a human, for the overview badge. */
export function countActionable(rows: readonly StuckPaymentEvent[]): number {
  return rows.filter((row) => isActionableUnappliedReason(row.reason)).length
}
