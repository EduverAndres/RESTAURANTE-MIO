// Whether a corporate account can pay for an order. Pure.
//
// The authority is `public.authorize_corporate_payment` (migration 0800): it
// locks the order and then the company, so two employees cannot both spend
// the last of the credit line. This module is the same rule in TypeScript,
// for the checkout to refuse early with a clear message and for the panels to
// show what is left. The rejections are checked in the same order in both
// places (`CORPORATE_REJECTIONS`); tests/companies-budget.test.ts walks it.
//
// MIRRORED IN SQL: the predicates below exist as text in lib/companies/sql.ts,
// embedded verbatim in the migrations; tests/companies-sql-drift.test.ts
// compares both versions over every combination.
import type {
  CompanyStatus,
  CorporateRejection,
  StatementStatus,
} from '@/lib/companies/vocabulary'
import { OPEN_STATEMENT_STATUSES } from '@/lib/companies/vocabulary'
import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/types/app'

export interface CorporateCompanyFacts {
  status: CompanyStatus
  credit_limit: number
  max_tip_pct: number
  /** See `creditUsed`. */
  credit_used: number
  /** A statement with money due is past its due date (Bogotá). */
  overdue: boolean
}

export interface CorporateMemberFacts {
  active: boolean
  /** Null: no personal monthly budget, only the company's credit line. */
  monthly_budget: number | null
  /** Null: no cap per order. */
  per_order_limit: number | null
  /** Authorised, live orders of this member in the current period. */
  spent_this_month: number
}

/** The order being paid, in whole pesos, after discounts. */
export interface CorporateChargeFacts {
  total: number
  subtotal: number
  tip: number
}

export type CorporateDecision =
  { ok: true } | { ok: false; reason: CorporateRejection }

/** The tip, as a share of the subtotal, is over the company's maximum. */
export function tipExceeds(
  order: Pick<CorporateChargeFacts, 'subtotal' | 'tip'>,
  maxTipPct: number,
): boolean {
  return order.tip * 100 > maxTipPct * order.subtotal
}

export function authorizeCorporateCharge(
  company: CorporateCompanyFacts,
  member: CorporateMemberFacts | null,
  order: CorporateChargeFacts,
): CorporateDecision {
  if (company.status !== 'active') return reject('company_inactive')
  if (company.overdue) return reject('company_overdue')
  if (!member || !member.active) return reject('member_inactive')
  if (member.per_order_limit !== null && order.total > member.per_order_limit)
    return reject('over_order_limit')
  if (tipExceeds(order, company.max_tip_pct)) return reject('tip_too_high')
  if (
    member.monthly_budget !== null &&
    member.spent_this_month + order.total > member.monthly_budget
  )
    return reject('over_member_budget')
  if (company.credit_used + order.total > company.credit_limit)
    return reject('over_credit_limit')
  return { ok: true }
}

function reject(reason: CorporateRejection): CorporateDecision {
  return { ok: false, reason }
}

/**
 * Credit in use: authorised orders not billed yet, plus statements not paid
 * yet, minus refunds of billed orders that no statement has credited yet.
 */
export function creditUsed(parts: {
  unbilled: number
  openStatements: number
  pendingCredits: number
}): number {
  return parts.unbilled + parts.openStatements - parts.pendingCredits
}

/** What is left of the member's monthly budget; null when they have none. */
export function memberRemaining(member: CorporateMemberFacts): number | null {
  if (member.monthly_budget === null) return null
  return Math.max(0, member.monthly_budget - member.spent_this_month)
}

/** The most this member can charge now: budget left or credit left. */
export function availableToSpend(
  company: Pick<CorporateCompanyFacts, 'credit_limit' | 'credit_used'>,
  member: CorporateMemberFacts,
): number {
  const credit = Math.max(0, company.credit_limit - company.credit_used)
  const budget = memberRemaining(member)
  return budget === null ? credit : Math.min(credit, budget)
}

interface OrderFacts {
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  status: OrderStatus
}

/**
 * An order that takes credit: corporate, authorised, not cancelled. A
 * cancellation gives the credit back without writing anything; a refund
 * (`refunded`) gives the member's budget back the same way.
 */
export function holdsCorporateCredit(order: OrderFacts): boolean {
  return (
    order.payment_method === 'corporate' &&
    order.payment_status === 'paid' &&
    order.status !== 'cancelled'
  )
}

/**
 * An order a statement bills: corporate and delivered. A refunded one is
 * still billed, and its refund is credited on the same or a later statement.
 */
export function isBillableCharge(order: OrderFacts): boolean {
  return (
    order.payment_method === 'corporate' &&
    order.status === 'delivered' &&
    (order.payment_status === 'paid' || order.payment_status === 'refunded')
  )
}

/** Unpaid, with something to pay, and past its due date in Bogotá. */
export function isStatementOverdue(
  statement: { status: StatementStatus; total: number; due_on: string },
  today: string,
): boolean {
  return (
    OPEN_STATEMENT_STATUSES.includes(statement.status) &&
    statement.total > 0 &&
    statement.due_on < today
  )
}
