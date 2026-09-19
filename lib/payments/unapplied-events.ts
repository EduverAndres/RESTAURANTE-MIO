// Why a stored gateway event never reached its order.
//
// `payment_events.applied_at IS NULL` says an event was received and never
// written to an order. It does not say why, and the why is what decides who
// has to do something about it. This module owns that rule set once, so the
// psql audit script (`scripts/audit-unapplied-events.sql`) and the admin
// screen (`app/admin/payments`) cannot answer the same question differently:
// the script embeds the SQL emitted here between `codegen:` markers and
// `tests/unapplied-events.test.ts` fails the build if the two drift apart.
//
// Pure: no React, no Supabase, safe on client and server.
import type { StatusTone } from '@/lib/orders/status'
import type { PaymentStatus } from '@/types/app'

export type UnappliedEventReason =
  /** The gateway approved the charge and the order is not paid. Costs money. */
  | 'approved_not_paid'
  /** The charged amount and the order total disagree. Never auto-apply. */
  | 'amount_mismatch'
  /** The reference pointed at no order, or the order was deleted. */
  | 'unknown_order'
  /** The gateway declined and the order is still awaiting payment. */
  | 'declined_still_open'
  /** Event and order agree; the write simply has not happened yet. */
  | 'apply_pending'

/**
 * Every reason, most expensive first. The admin table sorts on this, so the
 * row that is costing money is never below the row that is merely noisy.
 */
export const UNAPPLIED_EVENT_REASONS: readonly UnappliedEventReason[] = [
  'approved_not_paid',
  'amount_mismatch',
  'unknown_order',
  'declined_still_open',
  'apply_pending',
]

/** The order an event resolved to, or `null` when it resolved to none. */
export interface UnappliedEventOrder {
  payment_status: PaymentStatus
  /** In the same units as `orders.total` (pesos), not cents. */
  total: number
}

export interface UnappliedEventInput {
  /** Raw provider status (`APPROVED`, `DECLINED`, `ERROR`, `VOIDED`, ...). */
  gateway_status: string
  /** Provider amount in cents, or `null` when the event carried none. */
  amount_in_cents: number | null
  order: UnappliedEventOrder | null
}

/** Provider statuses that mean "the charge did not go through". */
const FAILED_GATEWAY_STATUSES = ['DECLINED', 'ERROR'] as const

/**
 * One classification rule in both dialects.
 *
 * `matches` is what the app evaluates; `sql` is the same predicate against
 * `payment_events e` left joined to `orders o`. They are written next to each
 * other on purpose — editing one without the other is the drift this module
 * exists to prevent, and the test compares the emitted SQL with the script.
 */
interface UnappliedEventRule {
  reason: Exclude<UnappliedEventReason, 'apply_pending'>
  sql: string
  matches: (input: UnappliedEventInput) => boolean
}

/** `orders.total` is in pesos; the gateway speaks cents. */
function totalInCents(order: UnappliedEventOrder): number {
  return Math.round(order.total * 100)
}

/**
 * Ordered: the first match wins, in both dialects. `unknown_order` has to
 * come first because every later rule dereferences the order.
 */
export const UNAPPLIED_EVENT_RULES: readonly UnappliedEventRule[] = [
  {
    reason: 'unknown_order',
    sql: 'o.id is null',
    matches: (input) => input.order === null,
  },
  {
    reason: 'amount_mismatch',
    sql: 'e.amount_in_cents is not null\n      and e.amount_in_cents <> round(o.total * 100)',
    matches: (input) =>
      input.amount_in_cents !== null &&
      input.order !== null &&
      input.amount_in_cents !== totalInCents(input.order),
  },
  {
    reason: 'approved_not_paid',
    sql: "e.status = 'APPROVED' and o.payment_status <> 'paid'",
    matches: (input) =>
      input.gateway_status === 'APPROVED' &&
      input.order !== null &&
      input.order.payment_status !== 'paid',
  },
  {
    reason: 'declined_still_open',
    sql: "e.status in ('DECLINED', 'ERROR') and o.payment_status = 'pending'",
    matches: (input) =>
      (FAILED_GATEWAY_STATUSES as readonly string[]).includes(
        input.gateway_status,
      ) &&
      input.order !== null &&
      input.order.payment_status === 'pending',
  },
]

/**
 * Why this event never reached its order. `apply_pending` is the fallback:
 * everything agrees, so the write is either in flight or awaiting the
 * gateway's next delivery — nobody has to do anything yet.
 */
export function classifyUnappliedEvent(
  input: UnappliedEventInput,
): UnappliedEventReason {
  const rule = UNAPPLIED_EVENT_RULES.find((candidate) =>
    candidate.matches(input),
  )
  return rule ? rule.reason : 'apply_pending'
}

/**
 * The `case` expression the audit script embeds. Returns NULL for rows that
 * match no rule, which in the script is impossible because the same rules
 * also make up the `where`.
 */
export function unappliedEventCaseSql(): string {
  const whens = UNAPPLIED_EVENT_RULES.map(
    (rule) => `    when ${rule.sql}\n      then '${rule.reason}'`,
  ).join('\n')
  return `case\n${whens}\n  end`
}

/** The `where` disjunction the audit script embeds: any rule matching. */
export function unappliedEventWhereSql(): string {
  return UNAPPLIED_EVENT_RULES.map(
    (rule, index) => `${index === 0 ? '' : '  or '}(${rule.sql})`,
  ).join('\n')
}

export const UNAPPLIED_EVENT_REASON_LABELS: Record<
  UnappliedEventReason,
  string
> = {
  approved_not_paid: 'Cobrado y sin aplicar',
  amount_mismatch: 'Monto distinto',
  unknown_order: 'Pedido desconocido',
  declined_still_open: 'Rechazado y abierto',
  apply_pending: 'Pendiente de aplicar',
}

/** What the person reading the row is supposed to do about it. */
export const UNAPPLIED_EVENT_REASON_HINTS: Record<
  UnappliedEventReason,
  string
> = {
  approved_not_paid:
    'La pasarela aprobó el cobro y el pedido no quedó pagado. Concilia contra la pasarela.',
  amount_mismatch:
    'El monto cobrado y el total del pedido no coinciden. No lo apliques automáticamente.',
  unknown_order:
    'La referencia no corresponde a ningún pedido. Requiere revisión manual.',
  declined_still_open:
    'La pasarela rechazó el cobro y el pedido sigue esperando pago. Suele ser un reintento del cliente.',
  apply_pending:
    'El evento y el pedido coinciden. La pasarela volverá a entregarlo o el reintento está en curso.',
}

/** Shares the badge vocabulary with every other status in the app. */
export const UNAPPLIED_EVENT_REASON_TONES: Record<
  UnappliedEventReason,
  StatusTone
> = {
  approved_not_paid: 'destructive',
  amount_mismatch: 'destructive',
  unknown_order: 'warning',
  declined_still_open: 'info',
  apply_pending: 'neutral',
}

/**
 * Reasons that need a human. `apply_pending` and `declined_still_open` do
 * not: the first resolves itself on the gateway's next delivery, the second
 * is normally a customer retry. The admin badge counts only these, so the
 * number on the overview means "somebody has to look", not "rows exist".
 */
export const ACTIONABLE_UNAPPLIED_REASONS: readonly UnappliedEventReason[] = [
  'approved_not_paid',
  'amount_mismatch',
  'unknown_order',
]

export function isActionableUnappliedReason(
  reason: UnappliedEventReason,
): boolean {
  return ACTIONABLE_UNAPPLIED_REASONS.includes(reason)
}

/**
 * Sort key: most expensive reason first, then oldest first.
 *
 * Oldest rather than newest within a reason, and deliberately so: among two
 * charges that both approved and never applied, the one that has been wrong
 * for three weeks is the one somebody has to look at. It also matches the
 * order `scripts/audit-unapplied-events.sql` returns, so the psql audit and
 * the admin screen put the same row at the top.
 */
export function compareUnappliedEvents(
  a: { reason: UnappliedEventReason; received_at: string },
  b: { reason: UnappliedEventReason; received_at: string },
): number {
  const byReason =
    UNAPPLIED_EVENT_REASONS.indexOf(a.reason) -
    UNAPPLIED_EVENT_REASONS.indexOf(b.reason)
  if (byReason !== 0) return byReason
  return a.received_at.localeCompare(b.received_at)
}
