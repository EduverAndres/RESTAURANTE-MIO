import type { PaymentStatus } from '@/types/app'

// Pure guard applied before writing a new payment status on an order.
// `refunded` is terminal and `paid` can never be silently overwritten with
// `failed` (a late webhook or a stale reconciliation must never undo a
// successful charge). Every other move, including same-to-same no-ops, is
// allowed.
const FORBIDDEN: Partial<Record<PaymentStatus, PaymentStatus[]>> = {
  paid: ['failed'],
  refunded: ['pending', 'paid', 'failed'],
}

export function canApplyPaymentStatus(
  from: PaymentStatus,
  to: PaymentStatus,
): boolean {
  if (from === to) return true
  return !(FORBIDDEN[from] ?? []).includes(to)
}
