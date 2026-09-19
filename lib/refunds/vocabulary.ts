// The vocabulary a recorded refund is described with.
//
// Kept in TypeScript rather than as PostgreSQL enums on purpose: these are
// bookkeeping labels that will grow (a new return channel, a new reason) and
// `alter type ... add value` cannot run inside the transaction
// `supabase db push` wraps every migration file in. The table uses text
// columns with a `check` constraint instead, and this module is the single
// source both the constraint and the UI are written from.
//
// Pure: no React, no Supabase, safe on client and server.

export const REFUND_REASONS = [
  'customer_request',
  'order_not_delivered',
  'duplicate_charge',
  'store_cancelled',
  'fraud',
  'other',
] as const
export type RefundReason = (typeof REFUND_REASONS)[number]

export const REFUND_REASON_LABELS: Record<RefundReason, string> = {
  customer_request: 'Solicitud del cliente',
  order_not_delivered: 'Pedido no entregado',
  duplicate_charge: 'Cobro duplicado',
  store_cancelled: 'Cancelado por el restaurante',
  fraud: 'Transacción fraudulenta',
  other: 'Otro motivo',
}

/**
 * How the money physically went back. `gateway` exists so the vocabulary is
 * ready for it, but nothing in this codebase calls a gateway refund API yet:
 * see `lib/refunds/gateway.ts`. Today it means "refunded from the provider's
 * own dashboard, by hand", which is bookkeeping just like the rest.
 */
export const REFUND_METHODS = [
  'cash',
  'bank_transfer',
  'gateway',
  'store_credit',
  'other',
] as const
export type RefundMethod = (typeof REFUND_METHODS)[number]

export const REFUND_METHOD_LABELS: Record<RefundMethod, string> = {
  cash: 'Efectivo',
  bank_transfer: 'Transferencia bancaria',
  gateway: 'Pasarela de pago',
  store_credit: 'Saldo a favor',
  other: 'Otro medio',
}

/**
 * The value list a `check (col in (...))` constraint is written from.
 *
 * The constraint in `supabase/migrations/20260919000400_refunds.sql` embeds
 * this output between `codegen:` markers and
 * `tests/refunds-vocabulary-drift.test.ts` compares the file against this
 * module — the same tripwire `lib/payments/unapplied-events.ts` uses for the
 * psql audit script. Without that test this function would be a promise
 * nothing kept: a reason added here and not there would pass every check in
 * the codebase and then fail a merchant mid-refund with a constraint
 * violation, which is worse than having no helper at all.
 *
 * Adding a value is therefore: append it here, run the test, paste its
 * expected output into the migration.
 */
export function sqlValueList(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(', ')
}
