// Invitations to a company account. Pure, safe on client and server.
//
// A company admin creates a link; whoever opens it signed in and accepts
// becomes a member with the budget the link carries. The token travels only
// in the link: the database keeps its SHA-256 (`company_invitations.
// token_hash`, see invitations.server.ts), so a leaked table cannot be turned
// back into working links.

/** Most days a link may stay open (also a check constraint in SQL). */
export const INVITATION_MAX_DAYS = 30
export const INVITATION_DEFAULT_DAYS = 7
/** Most people one link may admit (also a check constraint in SQL). */
export const INVITATION_MAX_USES = 200

export type InvitationState = 'active' | 'expired' | 'used_up' | 'revoked'

export const INVITATION_STATE_LABELS: Record<InvitationState, string> = {
  active: 'Activa',
  expired: 'Vencida',
  used_up: 'Sin cupos',
  revoked: 'Revocada',
}

export function invitationState(
  invitation: {
    revoked_at: string | null
    expires_at: string
    uses: number
    max_uses: number
  },
  now: Date,
): InvitationState {
  if (invitation.revoked_at !== null) return 'revoked'
  if (new Date(invitation.expires_at).getTime() <= now.getTime())
    return 'expired'
  if (invitation.uses >= invitation.max_uses) return 'used_up'
  return 'active'
}

/** What `peek_company_invitation` / `accept_company_invitation` answer. */
export const INVITATION_OUTCOMES = [
  'ok',
  'not_found',
  'expired',
  'used_up',
  'revoked',
  'already_member',
  'company_suspended',
] as const
export type InvitationOutcome = (typeof INVITATION_OUTCOMES)[number]

export const INVITATION_OUTCOME_MESSAGES: Record<
  Exclude<InvitationOutcome, 'ok'>,
  string
> = {
  not_found:
    'Este enlace de invitación no existe. Pide a tu empresa uno nuevo.',
  expired: 'Este enlace de invitación ya venció. Pide a tu empresa uno nuevo.',
  used_up:
    'Este enlace ya se usó todas las veces permitidas. Pide a tu empresa uno nuevo.',
  revoked: 'Tu empresa desactivó este enlace. Pide uno nuevo.',
  already_member:
    'Ya perteneces a una cuenta de empresa. Para unirte a otra, primero deben retirarte de la actual.',
  company_suspended:
    'La cuenta de esta empresa está suspendida. Habla con quien te invitó.',
}

/** base64url, 32 to 64 characters: the shape `newInvitationToken` produces. */
export function isInvitationTokenShape(token: string): boolean {
  return /^[A-Za-z0-9_-]{32,64}$/.test(token)
}

/** The link to share. */
export function invitationUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/empresa/unirse/${token}`
}

/** A WhatsApp share link (no number: the admin picks the chat). */
export function invitationWhatsAppUrl(
  companyName: string,
  url: string,
): string {
  const text = `Te invito a pedir con la cuenta de empresa de ${companyName} en Cerquita. Únete aquí: ${url}`
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}
