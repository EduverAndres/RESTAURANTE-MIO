// SQL mirrors of the corporate account rules. Pure.
//
// The migrations embed these strings verbatim between `codegen:` markers, and
// tests/companies-sql-drift.test.ts checks both that they are there byte for
// byte and that each predicate means what its TypeScript twin means, by
// evaluating the SQL text against the same rows.
import { NIT_WEIGHTS } from '@/lib/companies/nit'
import {
  INVITATION_MAX_DAYS,
  INVITATION_MAX_USES,
} from '@/lib/companies/invitations'
import {
  COMPANY_MEMBER_ROLES,
  COMPANY_STATUSES,
  OPEN_STATEMENT_STATUSES,
  STATEMENT_LINE_KINDS,
  STATEMENT_STATUSES,
} from '@/lib/companies/vocabulary'
import { CONSENT_SOURCES } from '@/lib/legal/consent'
import { sqlValueList } from '@/lib/refunds/vocabulary'

/** Mirror of `holdsCorporateCredit`, against an order `o`. */
export const HOLDS_CREDIT_SQL =
  "o.payment_method = 'corporate' and o.payment_status = 'paid' and o.status <> 'cancelled'"

/** Mirror of `isBillableCharge`, against an order `o`. */
export const BILLABLE_CHARGE_SQL =
  "o.payment_method = 'corporate' and o.status = 'delivered' and o.payment_status in ('paid', 'refunded')"

/** Mirror of `OPEN_STATEMENT_STATUSES`, against a statement `s`. */
export const STATEMENT_OPEN_SQL = `s.status in (${sqlValueList(OPEN_STATEMENT_STATUSES)})`

/** Mirror of `isStatementOverdue`, against `s` and a Bogotá date `v_today`. */
export const STATEMENT_OVERDUE_SQL = `${STATEMENT_OPEN_SQL} and s.total > 0 and s.due_on < v_today`

/**
 * Mirror of `statementDisplayStatus` turning `issued` into `overdue`, for
 * `refresh_overdue_company_statements`.
 */
export const STATEMENT_BECOMES_OVERDUE_SQL =
  "s.status = 'issued' and s.total > 0 and s.due_on < v_today"

/** Mirror of `tipExceeds`, against the locked order and company. */
export const TIP_EXCEEDS_SQL =
  'v_order.tip * 100 > v_company.max_tip_pct * v_order.subtotal'

/** The blocks 20261124000600_companies.sql embeds, by marker name. */
export function companySqlBlocks(): Record<string, string> {
  return {
    nit_weights: NIT_WEIGHTS.join(', '),
    company_statuses: sqlValueList(COMPANY_STATUSES),
    company_member_roles: sqlValueList(COMPANY_MEMBER_ROLES),
    invitation_roles: sqlValueList(COMPANY_MEMBER_ROLES),
    invitation_max_uses: String(INVITATION_MAX_USES),
    invitation_max_days: String(INVITATION_MAX_DAYS),
    statement_statuses: sqlValueList(STATEMENT_STATUSES),
    open_statements_index: sqlValueList(OPEN_STATEMENT_STATUSES),
    statement_line_kinds: sqlValueList(STATEMENT_LINE_KINDS),
    holds_credit_unbilled: HOLDS_CREDIT_SQL,
    holds_credit_spent: HOLDS_CREDIT_SQL,
    statement_open_credit: STATEMENT_OPEN_SQL,
    statement_overdue: STATEMENT_OVERDUE_SQL,
    consent_sources: sqlValueList(CONSENT_SOURCES),
  }
}

/** The blocks 20261124000700_company_rpcs.sql embeds. */
export function companyRpcSqlBlocks(): Record<string, string> {
  return {
    holds_credit_summary: HOLDS_CREDIT_SQL,
    statement_open_summary: STATEMENT_OPEN_SQL,
  }
}

/** The blocks 20261124000800_corporate_charges.sql embeds. */
export function corporateChargeSqlBlocks(): Record<string, string> {
  return {
    tip_exceeds: TIP_EXCEEDS_SQL,
    billable_charge: BILLABLE_CHARGE_SQL,
    statement_becomes_overdue: STATEMENT_BECOMES_OVERDUE_SQL,
    open_statements_void: sqlValueList(OPEN_STATEMENT_STATUSES),
  }
}
