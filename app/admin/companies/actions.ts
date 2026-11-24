'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { requireRole } from '@/lib/auth'
import { bogotaMonthStart, periodLabel } from '@/lib/companies/period'
import { companyDisplayName } from '@/lib/companies/vocabulary'
import { isUuid } from '@/lib/dashboard/active-store'
import { formatCOP } from '@/lib/format'
import { formatDateCO } from '@/lib/format-date'
import { logger } from '@/lib/log/logger'
import {
  companyStatementNotification,
  fromPush,
} from '@/lib/notifications/messages'
import { notify } from '@/lib/notifications/send'
import { companyReviewMessage } from '@/lib/push/messages'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  companyApprovalSchema,
  companySuspendSchema,
  statementPaidSchema,
  statementPeriodSchema,
  statementVoidSchema,
  type CompanyApprovalInput,
  type CompanySuspendInput,
  type StatementPaidInput,
  type StatementVoidInput,
} from '@/lib/validations/companies'

// The Cerquita team's side of company accounts. Writes go through the
// service role after `requireRole(['admin'])`; every status change is a
// compare-and-set on the status read, like payouts.

export type AdminCompanyResult = { ok: true } | { ok: false; error: string }

const GENERIC = 'No pudimos completar la acción. Inténtalo de nuevo.'

function firstMessage(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? 'Datos inválidos.'
}

function notifyAdmins(
  companyId: string,
  status: 'active' | 'suspended',
  companyName: string,
) {
  after(
    notify(
      { companyAdmins: companyId },
      fromPush('company_reviewed', companyReviewMessage(status, companyName)),
    ),
  )
}

/** Tells each billed company's admins that its statement is out. */
async function notifyNewStatements(period: string, since: string) {
  const { data, error } = await createAdminClient()
    .from('company_statements')
    .select('company_id, total, due_on')
    .eq('period', period)
    .gte('created_at', since)
  if (error) {
    logger.error('company_statements.notify_load_failed', { period }, error)
    return
  }
  await Promise.all(
    (data ?? []).map((statement) =>
      notify(
        { companyAdmins: statement.company_id },
        companyStatementNotification({
          periodLabel: periodLabel(period),
          amountLabel: formatCOP(Number(statement.total)),
          dueLabel: formatDateCO(new Date(`${statement.due_on}T12:00:00`)),
        }),
      ),
    ),
  )
}

/**
 * Approves a pending company, or reactivates a suspended one, with its credit
 * line, payment terms and tip cap. From here its members can charge it.
 */
export async function approveCompany(
  input: CompanyApprovalInput,
): Promise<AdminCompanyResult> {
  const parsed = companyApprovalSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstMessage(parsed.error) }
  const values = parsed.data

  const { user } = await requireRole(['admin'])
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('companies')
    .update({
      status: 'active',
      credit_limit: values.creditLimit,
      payment_terms_days: values.paymentTermsDays,
      max_tip_pct: values.maxTipPct,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      suspended_at: null,
      status_note: null,
    })
    .eq('id', values.companyId)
    .in('status', ['pending', 'suspended'])
    .select('id, legal_name, trade_name')
  if (error) {
    logger.error(
      'admin.company.approve_failed',
      { companyId: values.companyId },
      error,
    )
    return { ok: false, error: GENERIC }
  }
  const row = data?.[0]
  if (!row)
    return {
      ok: false,
      error: 'Esta empresa ya está activa o cambió mientras tanto.',
    }

  logger.info('admin.company.approved', {
    companyId: row.id,
    creditLimit: values.creditLimit,
  })
  notifyAdmins(row.id, 'active', companyDisplayName(row))
  revalidatePath('/admin/companies')
  return { ok: true }
}

/**
 * Changes an active company's credit line, payment terms or tip cap. A lower
 * credit line under what is already used simply blocks new charges.
 */
export async function updateCompanyTerms(
  input: CompanyApprovalInput,
): Promise<AdminCompanyResult> {
  const parsed = companyApprovalSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstMessage(parsed.error) }
  const values = parsed.data

  await requireRole(['admin'])
  const { data, error } = await createAdminClient()
    .from('companies')
    .update({
      credit_limit: values.creditLimit,
      payment_terms_days: values.paymentTermsDays,
      max_tip_pct: values.maxTipPct,
    })
    .eq('id', values.companyId)
    .eq('status', 'active')
    .select('id')
  if (error) {
    logger.error(
      'admin.company.terms_failed',
      { companyId: values.companyId },
      error,
    )
    return { ok: false, error: GENERIC }
  }
  if (!data || data.length === 0)
    return { ok: false, error: 'Solo se ajusta una empresa activa.' }
  revalidatePath('/admin/companies')
  return { ok: true }
}

/** Suspends an active company: nobody can charge it until it is reactivated. */
export async function suspendCompany(
  input: CompanySuspendInput,
): Promise<AdminCompanyResult> {
  const parsed = companySuspendSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstMessage(parsed.error) }
  const values = parsed.data

  await requireRole(['admin'])
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('companies')
    .update({
      status: 'suspended',
      suspended_at: new Date().toISOString(),
      status_note: values.note,
    })
    .eq('id', values.companyId)
    .eq('status', 'active')
    .select('id, legal_name, trade_name')
  if (error) {
    logger.error(
      'admin.company.suspend_failed',
      { companyId: values.companyId },
      error,
    )
    return { ok: false, error: GENERIC }
  }
  const row = data?.[0]
  if (!row) return { ok: false, error: 'Solo se suspende una empresa activa.' }

  notifyAdmins(row.id, 'suspended', companyDisplayName(row))
  revalidatePath('/admin/companies')
  return { ok: true }
}

export type GenerateStatementsResult =
  | { ok: true; created: number; skipped: number; lines: number }
  | { ok: false; error: string }

/**
 * Bills a closed month: one statement per company with something to bill.
 * One transaction (`generate_company_statements`), so a failed run writes
 * nothing; a second run for the same month skips the companies already
 * billed. Then stamps statements that went past due.
 */
export async function generateCompanyStatements(
  period: string,
): Promise<GenerateStatementsResult> {
  const parsed = statementPeriodSchema.safeParse(period)
  if (!parsed.success) return { ok: false, error: firstMessage(parsed.error) }
  if (parsed.data >= bogotaMonthStart())
    return {
      ok: false,
      error: 'Ese mes todavía no termina. Genera meses ya cerrados.',
    }

  await requireRole(['admin'])
  const admin = createAdminClient()
  // Statements written by this run are the ones created from now on: a
  // second run for the same month notifies nobody twice.
  const startedAt = new Date().toISOString()
  const { data, error } = await admin.rpc('generate_company_statements', {
    p_period: parsed.data,
  })
  const row = Array.isArray(data) ? data[0] : null
  if (error || !row) {
    logger.error('company_statements.generate_failed', { period }, error)
    return {
      ok: false,
      error: 'No pudimos generar los estados de cuenta. Inténtalo de nuevo.',
    }
  }
  const { error: overdueError } = await admin.rpc(
    'refresh_overdue_company_statements',
  )
  if (overdueError)
    logger.error('company_statements.overdue_failed', {}, overdueError)

  logger.info('company_statements.generated', {
    period,
    created: row.statements_created,
    skipped: row.statements_skipped,
    lines: row.lines_added,
  })
  revalidatePath('/admin/companies/statements')
  revalidatePath('/empresa/estados-de-cuenta')
  if (Number(row.statements_created) > 0)
    after(() => notifyNewStatements(parsed.data, startedAt))
  return {
    ok: true,
    created: Number(row.statements_created),
    skipped: Number(row.statements_skipped),
    lines: Number(row.lines_added),
  }
}

/** Stamps every issued statement past its due date as overdue. */
export async function refreshOverdueStatements(): Promise<
  { ok: true; updated: number } | { ok: false; error: string }
> {
  await requireRole(['admin'])
  const { data, error } = await createAdminClient().rpc(
    'refresh_overdue_company_statements',
  )
  if (error) {
    logger.error('company_statements.overdue_failed', {}, error)
    return { ok: false, error: GENERIC }
  }
  revalidatePath('/admin/companies/statements')
  return { ok: true, updated: Number(data ?? 0) }
}

/** Records the payment of an open statement, like a payout. */
export async function markStatementPaid(
  input: StatementPaidInput,
): Promise<AdminCompanyResult> {
  const parsed = statementPaidSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstMessage(parsed.error) }
  const values = parsed.data

  await requireRole(['admin'])
  const { data, error } = await createAdminClient()
    .from('company_statements')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      payment_ref: values.paymentRef || null,
    })
    .eq('id', values.statementId)
    .in('status', ['issued', 'overdue'])
    .select('id')
  if (error) {
    logger.error(
      'company_statements.mark_paid_failed',
      { statementId: values.statementId },
      error,
    )
    return {
      ok: false,
      error: 'No pudimos marcar el estado de cuenta como pagado.',
    }
  }
  if (!data || data.length === 0)
    return {
      ok: false,
      error: 'Este estado de cuenta ya se pagó o se anuló.',
    }
  revalidatePath('/admin/companies/statements')
  revalidatePath('/empresa/estados-de-cuenta')
  revalidatePath('/empresa')
  return { ok: true }
}

/** Annuls an unpaid statement; its orders can be billed again. */
export async function voidStatement(
  input: StatementVoidInput,
): Promise<AdminCompanyResult> {
  const parsed = statementVoidSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstMessage(parsed.error) }
  if (!isUuid(parsed.data.statementId))
    return { ok: false, error: 'Estado de cuenta inválido.' }

  await requireRole(['admin'])
  const { data, error } = await createAdminClient().rpc(
    'void_company_statement',
    { p_statement_id: parsed.data.statementId, p_reason: parsed.data.reason },
  )
  if (error) {
    logger.error(
      'company_statements.void_failed',
      { statementId: parsed.data.statementId },
      error,
    )
    return { ok: false, error: GENERIC }
  }
  if (data !== 'ok')
    return { ok: false, error: 'Solo se anula un estado de cuenta sin pagar.' }
  revalidatePath('/admin/companies/statements')
  revalidatePath('/empresa/estados-de-cuenta')
  return { ok: true }
}
