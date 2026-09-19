import type { PaymentStatus } from '@/types/app'

// Pure guard applied before writing a new payment status on an order.
//
// `refunded` is terminal, and a successful charge can only ever move forward
// to `refunded`: a late webhook or a stale reconciliation must never undo it,
// whether by declaring it `failed` or by dragging it back to `pending`.
//
// `paid -> pending` matters as much as `paid -> failed` because the two are
// reachable the same way. `payment_events` is unique on
// (provider, event_id, status), so the PENDING and the APPROVED delivery of
// one transaction are two different rows: a PENDING delivery whose write
// failed is retried by the gateway *after* the APPROVED one already charged
// the order, and without this entry that retry would silently mark a paid
// order pending again. Only `pending` and `failed` are re-openable states.
//
// Every other move, including same-to-same no-ops, is allowed.
const FORBIDDEN: Partial<Record<PaymentStatus, PaymentStatus[]>> = {
  paid: ['pending', 'failed'],
  refunded: ['pending', 'paid', 'failed'],
}

export function canApplyPaymentStatus(
  from: PaymentStatus,
  to: PaymentStatus,
): boolean {
  if (from === to) return true
  return !(FORBIDDEN[from] ?? []).includes(to)
}
