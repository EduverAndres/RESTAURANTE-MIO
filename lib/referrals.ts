// "Invita a un vecino": the shareable link and what each claim outcome tells
// the customer. Pure. The rules themselves (new customer, not yourself,
// monthly budget) live in the `claim_referral` database function.

/** `?ref=` on any page carries an invitation. */
export const REFERRAL_PARAM = 'ref'
/** Where the browser keeps an invitation until its owner has an account. */
export const REFERRAL_STORAGE_KEY = 'cerquita:referral'
/** An invitation that waited this long without an account is dropped. */
export const REFERRAL_TTL_MS = 30 * 24 * 60 * 60 * 1000

export const CLAIM_RESULTS = [
  'ok',
  'invalid_code',
  'self',
  'already_referred',
  'not_new',
  'budget',
  'unauthenticated',
  'failed',
] as const
export type ClaimResult = (typeof CLAIM_RESULTS)[number]

export function isClaimResult(value: unknown): value is ClaimResult {
  return (CLAIM_RESULTS as readonly unknown[]).includes(value)
}

/** Six letters and digits; anything else is not a code. */
export function normalizeReferralCode(
  raw: string | null | undefined,
): string | null {
  const code = (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  return code.length === 6 ? code : null
}

export function referralLink(siteUrl: string, code: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/?${REFERRAL_PARAM}=${code}`
}

/**
 * What to tell the customer, or null to say nothing. Only a welcome credit
 * and a paused programme are worth a toast; every other refusal is either
 * expected (it is your own link, you already ordered) or not actionable.
 */
export function claimMessage(
  result: ClaimResult,
  amountLabel: string,
): { tone: 'success' | 'info'; text: string } | null {
  if (result === 'ok')
    return {
      tone: 'success',
      text: `¡Bienvenido! Tienes ${amountLabel} para tu primer pedido.`,
    }
  if (result === 'budget')
    return {
      tone: 'info',
      text: 'Las invitaciones están en pausa este mes. Vuelve a intentarlo el próximo.',
    }
  return null
}

/** Whether the stored invitation should be kept for a later try. */
export function keepForLater(result: ClaimResult): boolean {
  return result === 'unauthenticated' || result === 'failed'
}
