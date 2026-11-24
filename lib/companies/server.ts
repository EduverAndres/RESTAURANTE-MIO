import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import {
  authorizeCorporateCharge,
  availableToSpend,
  type CorporateChargeFacts,
  type CorporateCompanyFacts,
  type CorporateDecision,
  type CorporateMemberFacts,
} from '@/lib/companies/budget'
import type { CorporateCheckoutOption } from '@/lib/companies/checkout'
import {
  COMPANY_MEMBER_ROLES,
  COMPANY_STATUSES,
  CORPORATE_REJECTION_MESSAGES,
  type CompanyMemberRole,
  type CompanyStatus,
} from '@/lib/companies/vocabulary'
import { corporateAccountsEnabled } from '@/lib/env.server'
import { logger } from '@/lib/log/logger'
import { createClient } from '@/lib/supabase/server'
import type { CompanyRow } from '@/types/app'
import type { Database } from '@/types/database'

type Client = SupabaseClient<Database>
type BudgetRow =
  Database['public']['Functions']['my_corporate_budget']['Returns'][number]

/** The signed-in user's membership and what they can charge right now. */
export interface CorporateBudget {
  companyId: string
  companyName: string
  companyStatus: CompanyStatus
  memberId: string
  role: CompanyMemberRole
  monthlyBudget: number | null
  perOrderLimit: number | null
  spentThisMonth: number
  /** Credit left on the company's line (never negative). */
  creditAvailable: number
  /** Admins only; null for members. */
  creditLimit: number | null
  creditUsed: number | null
  maxTipPct: number
  overdue: boolean
  period: string
}

/** RETURNS TABLE columns arrive as `number` in the types but may be null. */
function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value)
}

export function toCorporateBudget(row: BudgetRow): CorporateBudget {
  const status = (COMPANY_STATUSES as readonly string[]).includes(
    row.company_status,
  )
    ? (row.company_status as CompanyStatus)
    : 'pending'
  const role = (COMPANY_MEMBER_ROLES as readonly string[]).includes(row.role)
    ? (row.role as CompanyMemberRole)
    : 'member'
  return {
    companyId: row.company_id,
    companyName: row.company_name,
    companyStatus: status,
    memberId: row.member_id,
    role,
    monthlyBudget: nullableNumber(row.monthly_budget),
    perOrderLimit: nullableNumber(row.per_order_limit),
    spentThisMonth: Number(row.spent_this_month ?? 0),
    creditAvailable: Number(row.credit_available ?? 0),
    creditLimit: nullableNumber(row.credit_limit),
    creditUsed: nullableNumber(row.credit_used),
    maxTipPct: Number(row.max_tip_pct ?? 0),
    overdue: Boolean(row.overdue),
    period: row.period,
  }
}

/**
 * The caller's active membership, read through their own session (the RPC
 * uses `auth.uid()`). Null when they belong to no company or the read fails:
 * a broken read must hide the option, never offer credit blindly.
 */
export async function fetchMyCorporateBudget(
  supabase?: Client,
): Promise<CorporateBudget | null> {
  const client = supabase ?? (await createClient())
  const { data, error } = await client.rpc('my_corporate_budget')
  if (error) {
    logger.error('companies.budget_read_failed', {}, error)
    return null
  }
  const row = Array.isArray(data) ? data[0] : null
  return row ? toCorporateBudget(row) : null
}

/**
 * The budget as the facts `authorizeCorporateCharge` takes. A member does
 * not see the company's line, only what is left of it; `used + total > limit`
 * is the same test as `total > left`, so the left-over stands in for both.
 */
export function corporateFacts(budget: CorporateBudget): {
  company: CorporateCompanyFacts
  member: CorporateMemberFacts
} {
  return {
    company: {
      status: budget.companyStatus,
      credit_limit: budget.creditAvailable,
      credit_used: 0,
      max_tip_pct: budget.maxTipPct,
      overdue: budget.overdue,
    },
    member: {
      active: true,
      monthly_budget: budget.monthlyBudget,
      per_order_limit: budget.perOrderLimit,
      spent_this_month: budget.spentThisMonth,
    },
  }
}

/** The checkout's early answer; the database decides again on submit. */
export function precheckCorporateCharge(
  budget: CorporateBudget,
  order: CorporateChargeFacts,
): CorporateDecision {
  const { company, member } = corporateFacts(budget)
  return authorizeCorporateCharge(company, member, order)
}

export async function fetchCorporateCheckoutOption(): Promise<CorporateCheckoutOption | null> {
  if (!corporateAccountsEnabled()) return null
  const budget = await fetchMyCorporateBudget()
  if (!budget) return null
  const { company, member } = corporateFacts(budget)
  const blocked =
    budget.companyStatus !== 'active'
      ? budget.companyStatus === 'pending'
        ? 'Tu empresa todavía está en revisión. Podrás usarla cuando Cerquita la apruebe.'
        : CORPORATE_REJECTION_MESSAGES.company_inactive
      : budget.overdue
        ? CORPORATE_REJECTION_MESSAGES.company_overdue
        : null
  return {
    companyName: budget.companyName,
    available: availableToSpend(company, member),
    perOrderLimit: budget.perOrderLimit,
    maxTipPct: budget.maxTipPct,
    blocked,
  }
}

/**
 * The panel pages: a signed-in member of a company, or a redirect. Admin-only
 * pages pass `admin: true` and send a member back to the summary.
 */
export async function requireCompanyMember(
  next: string,
  { admin = false }: { admin?: boolean } = {},
): Promise<{ budget: CorporateBudget; supabase: Client }> {
  await requireUser(next)
  const supabase = await createClient()
  const budget = await fetchMyCorporateBudget(supabase)
  if (!budget || (admin && budget.role !== 'admin')) redirect('/empresa')
  return { budget, supabase }
}

/** The company row, read under the member's own RLS. */
export async function fetchCompany(
  supabase: Client,
  companyId: string,
): Promise<CompanyRow | null> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .maybeSingle()
  if (error) logger.error('companies.read_failed', { companyId }, error)
  return data
}
