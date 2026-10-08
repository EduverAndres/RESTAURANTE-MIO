/**
 * Legal consent: which documents exist, which version is in force, and the
 * rules every surface uses to decide whether a person has accepted it.
 *
 * Pure and dependency-free on purpose, so the middleware, server actions and
 * client forms all read the same answer.
 *
 * Bump `LEGAL_VERSION` whenever a document changes in substance: every
 * signed-in user who accepted an older version is asked again on their next
 * request (see `needsLegalAcceptance` and the gate in `middleware.ts`).
 */
export const LEGAL_VERSION = '2026-10-08'

/** Human date for the "Última actualización" line of every document. */
export const LEGAL_UPDATED_AT = '8 de octubre de 2026'

export const LEGAL_DOCUMENTS = [
  {
    key: 'terminos',
    href: '/terminos',
    title: 'Términos y Condiciones',
    summary: 'Las reglas de uso de la plataforma, pedidos, pagos y entregas.',
  },
  {
    key: 'privacidad',
    href: '/privacidad',
    title: 'Política de Tratamiento de Datos Personales',
    summary: 'Qué datos tratamos, para qué y cómo ejercer tus derechos.',
  },
  {
    key: 'cookies',
    href: '/cookies',
    title: 'Política de Cookies',
    summary: 'Qué guardamos en tu navegador y cómo controlarlo.',
  },
  {
    key: 'consumidor',
    href: '/proteccion-al-consumidor',
    title: 'Protección al Consumidor',
    summary: 'Retracto, reversión del pago, garantías y cómo reclamar.',
  },
  {
    key: 'aliados',
    href: '/terminos-aliados',
    title: 'Términos para Comercios y Repartidores',
    summary:
      'Condiciones para quien vende o entrega a través de la plataforma.',
  },
] as const

export type LegalDocumentKey = (typeof LEGAL_DOCUMENTS)[number]['key']

export const LEGAL_PATHS: readonly string[] = LEGAL_DOCUMENTS.map(
  (document) => document.href,
)

/** Where the gate sends a signed-in user who has not accepted yet. */
export const ACCEPT_PATH = '/aceptar-politicas'

/**
 * Set by the browser right before an OAuth redirect, after the person ticked
 * the box on the login form, so the callback can record that acceptance
 * instead of asking twice. Short-lived and carries only the version.
 */
export const LEGAL_PENDING_COOKIE = 'tienda_legal_pending'
export const LEGAL_PENDING_MAX_AGE = 60 * 10

export type ConsentSource =
  | 'register'
  | 'login-password'
  | 'login-sms'
  | 'login-google'
  | 'login-microsoft'
  | 'gate'

/** The keys written to `auth.users.raw_user_meta_data`. */
export interface LegalMetadata {
  legal_version?: string
  legal_accepted_at?: string
  legal_source?: ConsentSource
  marketing_opt_in?: boolean
}

export function hasAcceptedCurrent(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  return metadata?.legal_version === LEGAL_VERSION
}

/**
 * Paths a signed-in user may reach before accepting: the documents
 * themselves (you must be able to read what you are asked to accept), the
 * acceptance page, every auth route (sign-out, callbacks, password reset)
 * and machine endpoints.
 */
const EXEMPT_PREFIXES = [
  ACCEPT_PATH,
  '/legal',
  '/auth/',
  '/api/',
  '/login',
  '/register',
  '/forgot-password',
  '/account/reset-password',
  '/offline',
  '/monitoring',
]

export function isLegalExemptPath(pathname: string): boolean {
  if (LEGAL_PATHS.includes(pathname)) return true
  return EXEMPT_PREFIXES.some(
    (prefix) =>
      pathname === prefix ||
      pathname.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`),
  )
}

export function needsLegalAcceptance(
  pathname: string,
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  return !isLegalExemptPath(pathname) && !hasAcceptedCurrent(metadata)
}

export function legalMetadata(
  source: ConsentSource,
  marketingOptIn?: boolean,
  now: Date = new Date(),
): LegalMetadata {
  return {
    legal_version: LEGAL_VERSION,
    legal_accepted_at: now.toISOString(),
    legal_source: source,
    ...(marketingOptIn === undefined
      ? {}
      : { marketing_opt_in: marketingOptIn }),
  }
}
