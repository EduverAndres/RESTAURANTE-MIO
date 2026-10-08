import { APP_NAME } from '@/lib/env'

/**
 * Who answers for the platform, as the legal documents must state it.
 *
 * Ley 1480 de 2011 (art. 50) and Ley 1581 de 2012 require an online seller
 * and a data controller to identify themselves: legal name, tax id, address
 * and a working contact channel. These values are deployment configuration,
 * not copy, so they live in the environment. Until one is set the documents
 * show a bracketed placeholder on purpose — loud enough that nobody ships
 * the policies without filling it in.
 */
function value(raw: string | undefined, placeholder: string): string {
  const trimmed = raw?.trim()
  return trimmed ? trimmed : placeholder
}

export const COMPANY = {
  brand: APP_NAME,
  legalName: value(
    process.env.NEXT_PUBLIC_LEGAL_NAME,
    '[RAZÓN SOCIAL PENDIENTE]',
  ),
  nit: value(process.env.NEXT_PUBLIC_LEGAL_NIT, '[NIT PENDIENTE]'),
  address: value(
    process.env.NEXT_PUBLIC_LEGAL_ADDRESS,
    '[DIRECCIÓN PENDIENTE], Barranquilla, Atlántico, Colombia',
  ),
  city: 'Barranquilla, Atlántico, Colombia',
  email: value(
    process.env.NEXT_PUBLIC_LEGAL_EMAIL,
    '[CORREO DE CONTACTO PENDIENTE]',
  ),
  privacyEmail: value(
    process.env.NEXT_PUBLIC_PRIVACY_EMAIL ??
      process.env.NEXT_PUBLIC_LEGAL_EMAIL,
    '[CORREO DE PROTECCIÓN DE DATOS PENDIENTE]',
  ),
  phone: value(
    process.env.NEXT_PUBLIC_LEGAL_PHONE,
    '[TELÉFONO DE CONTACTO PENDIENTE]',
  ),
} as const

/** True while any identifying field still shows its placeholder. */
export const COMPANY_INCOMPLETE = Object.values(COMPANY).some((field) =>
  field.includes('PENDIENTE'),
)
