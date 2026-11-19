import { APP_NAME } from '@/lib/env'

/**
 * Who answers for the platform, as the legal documents must state it.
 *
 * Ley 1480 de 2011 (art. 50) and Ley 1581 de 2012 require an online seller
 * and a data controller to identify themselves: legal name, tax id, address
 * and a working contact channel. These values are deployment configuration,
 * not copy, so they live in the environment (NEXT_PUBLIC_*, inlined at build
 * time: changing them needs a rebuild). Until one is set the documents show a
 * bracketed placeholder on purpose — loud enough that nobody ships the
 * policies without filling it in.
 *
 * The NIT is the one exception in wording: while the DIAN has not assigned
 * it, the documents say "En trámite", which is true and not a placeholder.
 * Whether the identification is complete is decided from which variables are
 * missing, never from the text shown, so that wording cannot hide the gap:
 * COMPANY_INCOMPLETE stays true until the NIT exists.
 */

export interface CompanyEnv {
  NEXT_PUBLIC_LEGAL_NAME?: string
  NEXT_PUBLIC_LEGAL_NIT?: string
  NEXT_PUBLIC_LEGAL_ADDRESS?: string
  NEXT_PUBLIC_LEGAL_EMAIL?: string
  NEXT_PUBLIC_PRIVACY_EMAIL?: string
  NEXT_PUBLIC_LEGAL_PHONE?: string
}

export type CompanyField = 'legalName' | 'nit' | 'address' | 'email' | 'phone'

export const NIT_IN_PROGRESS = 'En trámite'

const CITY = 'Barranquilla, Atlántico, Colombia'

function clean(raw: string | undefined): string | null {
  const trimmed = raw?.trim()
  return trimmed ? trimmed : null
}

/** Pure: the company block and what is still missing, from an env object. */
export function buildCompany(source: CompanyEnv, brand: string) {
  const legalName = clean(source.NEXT_PUBLIC_LEGAL_NAME)
  const nit = clean(source.NEXT_PUBLIC_LEGAL_NIT)
  const address = clean(source.NEXT_PUBLIC_LEGAL_ADDRESS)
  const email = clean(source.NEXT_PUBLIC_LEGAL_EMAIL)
  const privacyEmail = clean(source.NEXT_PUBLIC_PRIVACY_EMAIL) ?? email
  const phone = clean(source.NEXT_PUBLIC_LEGAL_PHONE)

  const missing: CompanyField[] = []
  if (!legalName) missing.push('legalName')
  if (!nit) missing.push('nit')
  if (!address) missing.push('address')
  if (!email) missing.push('email')
  if (!phone) missing.push('phone')

  return {
    company: {
      brand,
      legalName: legalName ?? '[RAZÓN SOCIAL PENDIENTE]',
      nit: nit ?? NIT_IN_PROGRESS,
      address: address
        ? address.includes('Barranquilla')
          ? address
          : `${address}, ${CITY}`
        : `[DIRECCIÓN PENDIENTE], ${CITY}`,
      city: CITY,
      email: email ?? '[CORREO DE CONTACTO PENDIENTE]',
      privacyEmail: privacyEmail ?? '[CORREO DE PROTECCIÓN DE DATOS PENDIENTE]',
      phone: phone ?? '[TELÉFONO DE CONTACTO PENDIENTE]',
    },
    missing,
  }
}

// Literal property access so Next.js can inline the values at build time.
const built = buildCompany(
  {
    NEXT_PUBLIC_LEGAL_NAME: process.env.NEXT_PUBLIC_LEGAL_NAME,
    NEXT_PUBLIC_LEGAL_NIT: process.env.NEXT_PUBLIC_LEGAL_NIT,
    NEXT_PUBLIC_LEGAL_ADDRESS: process.env.NEXT_PUBLIC_LEGAL_ADDRESS,
    NEXT_PUBLIC_LEGAL_EMAIL: process.env.NEXT_PUBLIC_LEGAL_EMAIL,
    NEXT_PUBLIC_PRIVACY_EMAIL: process.env.NEXT_PUBLIC_PRIVACY_EMAIL,
    NEXT_PUBLIC_LEGAL_PHONE: process.env.NEXT_PUBLIC_LEGAL_PHONE,
  },
  APP_NAME,
)

export const COMPANY = built.company

/** Identifying fields not configured yet (the NIT counts while "En trámite"). */
export const COMPANY_MISSING_FIELDS: readonly CompanyField[] = built.missing

/** True while any identifying field is missing, the NIT included. */
export const COMPANY_INCOMPLETE = COMPANY_MISSING_FIELDS.length > 0
