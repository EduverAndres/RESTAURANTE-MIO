/**
 * The platform's own support line, if there is one.
 *
 * Optional on purpose: a "Soporte por WhatsApp" button that opens a dead
 * number costs more trust than no button at all, so every surface that offers
 * support renders nothing until `NEXT_PUBLIC_SUPPORT_WHATSAPP` is set.
 * Literal `process.env` access so Next.js can inline it into client bundles.
 */
const RAW = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? ''

/** Digits only, country code included (wa.me rejects `+`, spaces, dashes). */
const DIGITS = RAW.replace(/\D/g, '')

export const SUPPORT_WHATSAPP: string | null =
  DIGITS.length >= 10 ? DIGITS : null

export function supportWhatsAppUrl(message?: string): string | null {
  if (!SUPPORT_WHATSAPP) return null
  const text = message ? `?text=${encodeURIComponent(message)}` : ''
  return `https://wa.me/${SUPPORT_WHATSAPP}${text}`
}
