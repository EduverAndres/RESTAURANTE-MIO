// What a company's monthly statement bills. Pure.
//
// The writer is `public.generate_company_statements(period)` (migration
// 0800); this is the same plan in TypeScript, as its specification and for
// the tests. One line per order and kind, never twice (a unique index on
// live lines in the database):
//
//   * a `charge` for every delivered corporate order of the period or of an
//     earlier one (an order delivered after its month closed is caught up),
//     delivered before the period ends;
//   * a `refund`, negative, for every refund recorded before the period ends
//     on an order already charged — on an earlier statement or this one.
//
// A refund after delivery is therefore a credit (abono) on the next
// statement, never an edit of one already sent.
import { isBillableCharge, isStatementOverdue } from '@/lib/companies/budget'
import { addDaysToDate, periodBounds } from '@/lib/companies/period'
import type {
  StatementLineKind,
  StatementStatus,
} from '@/lib/companies/vocabulary'
import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/types/app'

export interface StatementOrderFacts {
  id: string
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  status: OrderStatus
  total: number
  corporate_period: string | null
  delivered_at: string | null
}

export interface StatementRefundFacts {
  order_id: string
  amount: number
  issued_at: string
}

export interface PlannedLine {
  order_id: string
  kind: StatementLineKind
  amount: number
}

export function planStatementLines({
  period,
  orders,
  refunds,
  billed,
}: {
  period: string
  orders: readonly StatementOrderFacts[]
  refunds: readonly StatementRefundFacts[]
  /** Live lines already on a statement (voided statements excluded). */
  billed: readonly { order_id: string; kind: StatementLineKind }[]
}): { lines: PlannedLine[]; total: number } {
  const end = periodBounds(period).end.getTime()
  const has = (orderId: string, kind: StatementLineKind) =>
    billed.some((line) => line.order_id === orderId && line.kind === kind)

  const charges: PlannedLine[] = orders
    .filter(
      (order) =>
        isBillableCharge(order) &&
        order.corporate_period !== null &&
        order.corporate_period <= period &&
        order.delivered_at !== null &&
        new Date(order.delivered_at).getTime() < end &&
        !has(order.id, 'charge'),
    )
    .map((order) => ({
      order_id: order.id,
      kind: 'charge',
      amount: order.total,
    }))

  const charged = (orderId: string) =>
    has(orderId, 'charge') || charges.some((line) => line.order_id === orderId)

  const credits: PlannedLine[] = refunds
    .filter(
      (refund) =>
        new Date(refund.issued_at).getTime() < end &&
        charged(refund.order_id) &&
        !has(refund.order_id, 'refund'),
    )
    .map((refund) => ({
      order_id: refund.order_id,
      kind: 'refund',
      amount: -refund.amount,
    }))

  // Each refund right after its own charge, when both are on this statement.
  const lines = [...charges]
  for (const credit of credits) {
    const at = lines.findIndex(
      (line) => line.order_id === credit.order_id && line.kind === 'charge',
    )
    if (at === -1) lines.push(credit)
    else lines.splice(at + 1, 0, credit)
  }
  return { lines, total: lines.reduce((sum, line) => sum + line.amount, 0) }
}

/** The due date: issued on, plus the company's payment terms. */
export function statementDueOn(issuedOn: string, termsDays: number): string {
  return addDaysToDate(issuedOn, termsDays)
}

/**
 * The status to show today. An `issued` statement past its due date reads
 * as overdue at once; `refresh_overdue_company_statements` stamps it later.
 */
export function statementDisplayStatus(
  statement: { status: StatementStatus; total: number; due_on: string },
  today: string,
): StatementStatus {
  if (statement.status === 'issued' && isStatementOverdue(statement, today))
    return 'overdue'
  return statement.status
}
