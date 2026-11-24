// Corporate accounts vocabulary. Pure, safe on client and server.
//
// MIRRORED IN SQL: the check constraints of `public.companies`,
// `public.company_members`, `public.company_invitations`,
// `public.company_statements` and `public.company_statement_lines`
// (supabase/migrations/20261124000600_companies.sql) embed these lists
// between `codegen:` markers; tests/companies-sql-drift.test.ts compares them.
import type { StatusTone } from '@/lib/orders/status'

/** Version of the Términos para Empresas a company accepts when it signs up. */
export const COMPANY_TERMS_VERSION = '2026-11-24'

export const COMPANY_STATUSES = ['pending', 'active', 'suspended'] as const
export type CompanyStatus = (typeof COMPANY_STATUSES)[number]

export const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  pending: 'En revisión',
  active: 'Activa',
  suspended: 'Suspendida',
}

export const COMPANY_STATUS_TONES: Record<CompanyStatus, StatusTone> = {
  pending: 'warning',
  active: 'success',
  suspended: 'destructive',
}

export const COMPANY_MEMBER_ROLES = ['admin', 'member'] as const
export type CompanyMemberRole = (typeof COMPANY_MEMBER_ROLES)[number]

export const COMPANY_ROLE_LABELS: Record<CompanyMemberRole, string> = {
  admin: 'Administrador',
  member: 'Empleado',
}

export const STATEMENT_STATUSES = ['issued', 'overdue', 'paid', 'void'] as const
export type StatementStatus = (typeof STATEMENT_STATUSES)[number]

export const STATEMENT_STATUS_LABELS: Record<StatementStatus, string> = {
  issued: 'Por pagar',
  overdue: 'Vencido',
  paid: 'Pagado',
  void: 'Anulado',
}

export const STATEMENT_STATUS_TONES: Record<StatementStatus, StatusTone> = {
  issued: 'warning',
  overdue: 'destructive',
  paid: 'success',
  void: 'neutral',
}

/** Statements the company still owes (they hold credit until paid). */
export const OPEN_STATEMENT_STATUSES: readonly StatementStatus[] = [
  'issued',
  'overdue',
]

/** A charge is an order billed; a refund is the credit for one refunded. */
export const STATEMENT_LINE_KINDS = ['charge', 'refund'] as const
export type StatementLineKind = (typeof STATEMENT_LINE_KINDS)[number]

export const STATEMENT_LINE_LABELS: Record<StatementLineKind, string> = {
  charge: 'Pedido',
  refund: 'Abono por reembolso',
}

/** Payment terms the admin can grant, in days after the statement is issued. */
export const PAYMENT_TERMS_OPTIONS = [15, 30, 45, 60] as const

/**
 * Why a corporate charge was refused, in the order both the database
 * (`authorize_corporate_payment`) and `authorizeCorporateCharge` check them.
 */
export const CORPORATE_REJECTIONS = [
  'company_inactive',
  'company_overdue',
  'member_inactive',
  'over_order_limit',
  'tip_too_high',
  'over_member_budget',
  'over_credit_limit',
] as const
export type CorporateRejection = (typeof CORPORATE_REJECTIONS)[number]

export const CORPORATE_REJECTION_MESSAGES: Record<CorporateRejection, string> =
  {
    company_inactive:
      'La cuenta de tu empresa no está activa. Paga con otro método o habla con el administrador de la cuenta.',
    company_overdue:
      'La cuenta de tu empresa tiene un estado de cuenta vencido. Cuando se pague podrás volver a usarla.',
    member_inactive:
      'Ya no haces parte de una cuenta de empresa activa. Paga con otro método.',
    over_order_limit:
      'Este pedido supera el tope por pedido que te asignó tu empresa.',
    tip_too_high:
      'La propina supera el máximo que permite tu empresa. Bájala para pagar con la cuenta de empresa.',
    over_member_budget:
      'Este pedido supera lo que te queda del presupuesto del mes.',
    over_credit_limit:
      'Tu empresa no tiene cupo suficiente para este pedido. Habla con el administrador de la cuenta.',
  }

/** Every outcome the authorization RPC can answer besides a rejection. */
export const CORPORATE_AUTH_OUTCOMES = [
  'ok',
  'not_found',
  'not_corporate',
  'not_pending',
  ...CORPORATE_REJECTIONS,
] as const
export type CorporateAuthOutcome = (typeof CORPORATE_AUTH_OUTCOMES)[number]

export function isCorporateRejection(
  value: string,
): value is CorporateRejection {
  return (CORPORATE_REJECTIONS as readonly string[]).includes(value)
}

/** The name a company goes by in the app: trade name first, legal name else. */
export function companyDisplayName(company: {
  legal_name: string
  trade_name: string | null
}): string {
  return company.trade_name?.trim() || company.legal_name
}
