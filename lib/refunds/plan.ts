// Decides whether an order can be refunded, and what row to write.
//
// Pure: no React, no Supabase. Both the merchant action and the admin action
// go through it, so "can this be refunded?" has exactly one answer.
//
// ---------------------------------------------------------------------------
// SCOPE: full refunds only
// ---------------------------------------------------------------------------
// A partial refund has nowhere to live yet. `payment_status` is an enum with
// no partial state, so an order given half its money back would have to stay
// `paid` (wrong: the merchant is settled on the full subtotal) or become
// `refunded` (wrong: most of the sale stands). Fixing that is a schema
// change, and the gateway side of it is unverified — see
// `lib/refunds/gateway.ts`. So `amount` is always the whole order total and
// the table carries a unique index on `order_id`.
//
// `amount` is still a real column rather than a derived `orders.total`
// lookup, because it is a snapshot: it records what was handed back at the
// moment it was handed back, the same reason `order_items.name_snapshot`
// exists. It also means partial refunds need no column added later — only
// that unique index dropped.
import { canApplyPaymentStatus } from '@/lib/payments/transitions'
import type { RefundMethod, RefundReason } from '@/lib/refunds/vocabulary'
import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/types/app'

/** The order fields that decide whether a refund is even offered. */
export interface RefundableOrder {
  status: OrderStatus
  payment_status: PaymentStatus
  payment_method: PaymentMethod
}

/** The order fields a refund decision depends on. */
export interface RefundOrder extends RefundableOrder {
  id: string
  store_id: string
  /** In the same units as `orders.total` (pesos), never cents. */
  total: number
}

export interface RefundInput {
  reason: RefundReason
  method: RefundMethod
  note: string | null
}

/** The row to insert into `public.refunds`. */
export interface PlannedRefund {
  order_id: string
  store_id: string
  amount: number
  reason: RefundReason
  method: RefundMethod
  note: string | null
}

/**
 * Who is recording the refund. It matters for one case only — see
 * `isCashRefundForbidden` — but it is a required argument everywhere so no
 * caller can forget to say which side of that rule it is on.
 */
export type RefundActor = 'merchant' | 'admin'

export type RefundRejection =
  | 'cash_admin_only'
  | 'already_refunded'
  | 'not_refundable'
  | 'transition_forbidden'
  | 'nothing_to_refund'
  /**
   * Not a `planRefund` outcome: the order moved between the read this plan
   * was decided on and the write. `public.record_refund` refuses unless the
   * row still holds the status the guard above was evaluated against, so a
   * decision made on a stale read is never applied — the person is asked to
   * look again instead. See `lib/refunds/record.ts`.
   */
  | 'status_changed'

export type RefundPlan =
  { ok: true; refund: PlannedRefund } | { ok: false; error: RefundRejection }

export const REFUND_REJECTION_MESSAGES: Record<RefundRejection, string> = {
  cash_admin_only:
    'Los reembolsos de pedidos en efectivo los registra el equipo de Cerquita. Escríbenos y lo revisamos contigo.',
  already_refunded: 'Este pedido ya tiene un reembolso registrado.',
  not_refundable: 'Este pedido no registró un pago que se pueda devolver.',
  transition_forbidden:
    'El estado de pago del pedido no permite registrar un reembolso.',
  nothing_to_refund: 'Este pedido no tiene un monto que devolver.',
  status_changed:
    'El pedido cambió de estado mientras registrabas el reembolso. Vuelve a abrirlo y revisa antes de reintentar.',
}

/**
 * Whether there is money to give back at all.
 *
 * Deliberately the mirror image of `isEligible` in `lib/payouts/compute.ts`:
 * an order the merchant is settled for is exactly an order that can be
 * reversed. A cash order never turns `paid` — the customer hands the money
 * over at the door — so it counts once it has been delivered, and an
 * electronic order counts once the gateway says `paid`. If the two rules ever
 * disagree, a refund either has no payout to reverse or reverses one that was
 * never made.
 */
export function isRefundable(order: RefundableOrder): boolean {
  if (order.payment_status === 'refunded') return false
  if (order.payment_status === 'paid') return true
  return order.payment_method === 'cash' && order.status === 'delivered'
}

/**
 * A merchant may not record a refund on a cash order.
 *
 * The cash is already in the merchant's hands, and recording a refund is pure
 * bookkeeping: the sale leaves the payout and the platform's commission is
 * reversed, while nothing actually moves. Left to the merchant, that is a
 * button that cancels the commission on any cash sale with no evidence
 * required. The platform still records genuine cash refunds from
 * `/admin/orders` after looking at the case.
 *
 * Orders paid online stay with the merchant: there the platform holds the
 * money, so a refund costs the merchant the sale and gains them nothing.
 */
function isCashRefundForbidden(
  order: Pick<RefundableOrder, 'payment_method'>,
  actor: RefundActor,
): boolean {
  return actor === 'merchant' && order.payment_method === 'cash'
}

/** Whether `actor` should be offered the "record a refund" control at all. */
export function canRecordRefund(
  order: RefundableOrder,
  actor: RefundActor,
): boolean {
  return isRefundable(order) && !isCashRefundForbidden(order, actor)
}

export function planRefund(
  order: RefundOrder,
  input: RefundInput,
  actor: RefundActor,
): RefundPlan {
  // `canApplyPaymentStatus` allows same-to-same, so it would happily let a
  // refunded order be refunded again. The explicit check comes first; the
  // unique index on `refunds.order_id` is the second line of defence for two
  // clicks racing each other.
  if (order.payment_status === 'refunded') {
    return { ok: false, error: 'already_refunded' }
  }
  if (isCashRefundForbidden(order, actor)) {
    return { ok: false, error: 'cash_admin_only' }
  }
  if (!isRefundable(order)) {
    return { ok: false, error: 'not_refundable' }
  }
  if (!canApplyPaymentStatus(order.payment_status, 'refunded')) {
    return { ok: false, error: 'transition_forbidden' }
  }
  if (!(order.total > 0)) {
    return { ok: false, error: 'nothing_to_refund' }
  }

  const note = input.note?.trim() ?? ''
  return {
    ok: true,
    refund: {
      order_id: order.id,
      store_id: order.store_id,
      amount: order.total,
      reason: input.reason,
      method: input.method,
      note: note.length > 0 ? note : null,
    },
  }
}
