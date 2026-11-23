'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { requireUser } from '@/lib/auth'
import {
  INVITATION_OUTCOME_MESSAGES,
  invitationUrl,
  invitationWhatsAppUrl,
  isInvitationTokenShape,
  type InvitationOutcome,
} from '@/lib/companies/invitations'
import { newInvitationToken } from '@/lib/companies/invitations.server'
import { parseNit } from '@/lib/companies/nit'
import { COMPANY_TERMS_VERSION } from '@/lib/companies/vocabulary'
import { logConsent } from '@/lib/legal/record'
import { logger } from '@/lib/log/logger'
import { siteUrl } from '@/lib/site-url'
import { createClient } from '@/lib/supabase/server'
import {
  companyBillingSchema,
  companyRegisterSchema,
  invitationCreateSchema,
  memberUpdateSchema,
  normalizePhone,
  type CompanyBillingInput,
  type CompanyRegisterInput,
  type InvitationCreateInput,
  type MemberUpdateInput,
} from '@/lib/validations/companies'

// Everything here runs as the signed-in user: the company functions of
// 20261124000700 read `auth.uid()` and decide on their own who may act, so
// these actions validate, call one function and translate its outcome.

export type CompanyActionResult =
  { ok: true } | { ok: false; error: string; field?: string }

const GENERIC = 'No pudimos guardar el cambio. Inténtalo de nuevo.'

function firstIssue(error: {
  issues: { message: string; path: PropertyKey[] }[]
}): { error: string; field?: string } {
  const issue = error.issues[0]
  return {
    error: issue?.message ?? 'Revisa los datos.',
    field: issue?.path[0] === undefined ? undefined : String(issue.path[0]),
  }
}

const REGISTER_MESSAGES: Record<string, { error: string; field?: string }> = {
  already_member: {
    error:
      'Ya perteneces a una cuenta de empresa. Para registrar otra, primero deben retirarte de la actual.',
  },
  nit_invalid: {
    error: 'El NIT o su dígito de verificación no son válidos.',
    field: 'nit',
  },
  nit_taken: {
    error:
      'Ya hay una cuenta con ese NIT. Pide al administrador de tu empresa que te invite.',
    field: 'nit',
  },
  invalid: { error: 'Revisa los datos de la empresa.' },
  forbidden: { error: 'Tu sesión expiró. Inicia sesión de nuevo.' },
}

/** Signs a company up; the caller becomes its first admin. */
export async function registerCompany(
  input: CompanyRegisterInput,
): Promise<CompanyActionResult> {
  const parsed = companyRegisterSchema.safeParse(input)
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) }
  const values = parsed.data
  const nit = parseNit(values.nit)
  if (!nit || nit.dv === null)
    return { ok: false, ...REGISTER_MESSAGES.nit_invalid }

  const { user } = await requireUser('/empresa/registro')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('register_company', {
    p_legal_name: values.legalName,
    p_trade_name: values.tradeName,
    p_nit: nit.nit,
    p_dv: nit.dv,
    p_billing_email: values.billingEmail,
    p_billing_address: values.billingAddress,
    p_city: values.city,
    p_contact_name: values.contactName,
    p_contact_phone: normalizePhone(values.contactPhone),
    p_terms_version: COMPANY_TERMS_VERSION,
  })
  const row = Array.isArray(data) ? data[0] : null
  if (error || !row) {
    logger.error('companies.register_failed', { userId: user.id }, error)
    return { ok: false, error: GENERIC }
  }
  if (row.outcome !== 'ok') {
    return {
      ok: false,
      ...(REGISTER_MESSAGES[row.outcome] ?? { error: GENERIC }),
    }
  }

  // Proof that this person accepted the Términos para Empresas.
  await logConsent({
    userId: user.id,
    source: 'company-register',
    headers: await headers(),
    marketingOptIn: null,
    documentVersion: COMPANY_TERMS_VERSION,
  })
  logger.info('companies.registered', {
    userId: user.id,
    companyId: row.company_id,
  })
  revalidatePath('/empresa')
  revalidatePath('/admin/companies')
  return { ok: true }
}

function invitationMessage(outcome: string): string {
  return outcome in INVITATION_OUTCOME_MESSAGES
    ? INVITATION_OUTCOME_MESSAGES[outcome as Exclude<InvitationOutcome, 'ok'>]
    : GENERIC
}

/** Joins the caller to the company of an invitation link. */
export async function acceptInvitation(
  token: string,
): Promise<CompanyActionResult> {
  if (!isInvitationTokenShape(token))
    return { ok: false, error: INVITATION_OUTCOME_MESSAGES.not_found }

  const { user } = await requireUser(`/empresa/unirse/${token}`)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('accept_company_invitation', {
    p_token: token,
  })
  const row = Array.isArray(data) ? data[0] : null
  if (error || !row) {
    logger.error('companies.join_failed', { userId: user.id }, error)
    return { ok: false, error: GENERIC }
  }
  if (row.outcome !== 'ok')
    return { ok: false, error: invitationMessage(row.outcome) }

  await logConsent({
    userId: user.id,
    source: 'company-join',
    headers: await headers(),
    marketingOptIn: null,
    documentVersion: COMPANY_TERMS_VERSION,
  })
  logger.info('companies.joined', {
    userId: user.id,
    companyId: row.company_id,
  })
  revalidatePath('/empresa')
  revalidatePath('/empresa/equipo')
  return { ok: true }
}

export type CreateInvitationResult =
  | { ok: true; url: string; whatsappUrl: string }
  | { ok: false; error: string; field?: string }

/**
 * Opens a join link. The token is made here and shown once; the database
 * keeps only its hash, so a lost link cannot be recovered, only replaced.
 */
export async function createInvitation(
  input: InvitationCreateInput,
  companyName: string,
): Promise<CreateInvitationResult> {
  const parsed = invitationCreateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) }
  const values = parsed.data

  await requireUser('/empresa/equipo')
  const { token, hash } = newInvitationToken()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_company_invitation', {
    p_company_id: values.companyId,
    p_token_hash: hash,
    p_role: values.role,
    // `null` is "no limit"; the generated types do not know the RPC takes it.
    p_monthly_budget: values.monthlyBudget as number,
    p_per_order_limit: values.perOrderLimit as number,
    p_max_uses: values.maxUses,
    p_expires_days: values.expiresDays,
  })
  const row = Array.isArray(data) ? data[0] : null
  if (error || !row) {
    logger.error(
      'companies.invite_failed',
      { companyId: values.companyId },
      error,
    )
    return { ok: false, error: GENERIC }
  }
  if (row.outcome === 'forbidden')
    return {
      ok: false,
      error: 'Solo un administrador de la empresa puede invitar.',
    }
  if (row.outcome === 'company_suspended')
    return { ok: false, error: INVITATION_OUTCOME_MESSAGES.company_suspended }
  if (row.outcome !== 'ok')
    return { ok: false, error: 'Revisa los datos de la invitación.' }

  const url = invitationUrl(siteUrl(), token)
  revalidatePath('/empresa/equipo')
  return {
    ok: true,
    url,
    whatsappUrl: invitationWhatsAppUrl(companyName.slice(0, 80), url),
  }
}

export async function revokeInvitation(
  invitationId: string,
): Promise<CompanyActionResult> {
  await requireUser('/empresa/equipo')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('revoke_company_invitation', {
    p_invitation_id: invitationId,
  })
  if (error) {
    logger.error('companies.revoke_failed', { invitationId }, error)
    return { ok: false, error: GENERIC }
  }
  if (data !== 'ok')
    return { ok: false, error: 'No encontramos esa invitación.' }
  revalidatePath('/empresa/equipo')
  return { ok: true }
}

const MEMBER_MESSAGES: Record<string, string> = {
  last_admin:
    'La empresa necesita al menos un administrador. Nombra a otro antes de cambiar este.',
  forbidden: 'Solo un administrador de la empresa puede cambiar el equipo.',
  not_found: 'No encontramos a esa persona en el equipo.',
  inactive: 'Esa persona ya no hace parte del equipo.',
  invalid: 'Revisa el presupuesto y el tope por pedido.',
}

/** Role, monthly budget, per-order cap, or removal from the team. */
export async function updateMember(
  input: MemberUpdateInput,
): Promise<CompanyActionResult> {
  const parsed = memberUpdateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) }
  const values = parsed.data

  await requireUser('/empresa/equipo')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('set_company_member', {
    p_member_id: values.memberId,
    p_role: values.role,
    p_monthly_budget: values.monthlyBudget as number,
    p_per_order_limit: values.perOrderLimit as number,
    p_active: values.active,
  })
  if (error) {
    logger.error(
      'companies.member_failed',
      { memberId: values.memberId },
      error,
    )
    return { ok: false, error: GENERIC }
  }
  if (data !== 'ok')
    return { ok: false, error: MEMBER_MESSAGES[data] ?? GENERIC }
  revalidatePath('/empresa')
  revalidatePath('/empresa/equipo')
  return { ok: true }
}

/** Billing contact: email, address, city, contact person and phone. */
export async function updateBilling(
  input: CompanyBillingInput,
): Promise<CompanyActionResult> {
  const parsed = companyBillingSchema.safeParse(input)
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) }
  const values = parsed.data

  await requireUser('/empresa')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('update_company_billing', {
    p_company_id: values.companyId,
    p_billing_email: values.billingEmail,
    p_billing_address: values.billingAddress,
    p_city: values.city,
    p_contact_name: values.contactName,
    p_contact_phone: normalizePhone(values.contactPhone),
  })
  if (error) {
    logger.error(
      'companies.billing_failed',
      { companyId: values.companyId },
      error,
    )
    return { ok: false, error: GENERIC }
  }
  if (data === 'forbidden')
    return {
      ok: false,
      error: 'Solo un administrador de la empresa puede cambiar estos datos.',
    }
  if (data !== 'ok')
    return { ok: false, error: 'Revisa los datos de facturación.' }
  revalidatePath('/empresa')
  return { ok: true }
}
