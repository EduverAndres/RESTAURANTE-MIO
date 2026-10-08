/**
 * Cookie consent and the inventory the cookie policy is rendered from.
 *
 * Today the platform only stores what it needs to work or what the person
 * explicitly chose (a theme, larger text). There is no analytics or
 * advertising tracking, and the policy says so. The optional categories
 * exist anyway, stored and readable through `hasCookieConsent`, so that the
 * day someone adds an analytics script the switch to respect is already
 * here — and the rule is: no optional script runs without it.
 */

export const COOKIE_CONSENT_NAME = 'tienda_cookie_consent'
/** Six months, after which the person is asked again. */
export const COOKIE_CONSENT_MAX_AGE = 60 * 60 * 24 * 180
const CONSENT_SCHEMA_VERSION = 1

/** Fired on `window` by any "Preferencias de cookies" link to reopen the panel. */
export const OPEN_COOKIE_PREFERENCES_EVENT = 'tienda:open-cookie-preferences'

export type OptionalCookieCategory = 'analytics' | 'marketing'

export interface CookieConsent {
  v: number
  analytics: boolean
  marketing: boolean
  /** ISO timestamp of the choice. */
  at: string
}

export function serializeConsent(
  choice: Pick<CookieConsent, OptionalCookieCategory>,
  now: Date = new Date(),
): string {
  const consent: CookieConsent = {
    v: CONSENT_SCHEMA_VERSION,
    analytics: choice.analytics,
    marketing: choice.marketing,
    at: now.toISOString(),
  }
  return encodeURIComponent(JSON.stringify(consent))
}

export function parseConsent(
  raw: string | null | undefined,
): CookieConsent | null {
  if (!raw) return null
  try {
    const value = JSON.parse(decodeURIComponent(raw)) as Partial<CookieConsent>
    if (
      value.v !== CONSENT_SCHEMA_VERSION ||
      typeof value.analytics !== 'boolean' ||
      typeof value.marketing !== 'boolean' ||
      typeof value.at !== 'string'
    ) {
      return null
    }
    return value as CookieConsent
  } catch {
    return null
  }
}

/** Reads one cookie from a `document.cookie`-style string. */
export function readCookie(cookieString: string, name: string): string | null {
  for (const part of cookieString.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return rest.join('=')
  }
  return null
}

/** Browser-only. False until the person has said yes to that category. */
export function hasCookieConsent(category: OptionalCookieCategory): boolean {
  if (typeof document === 'undefined') return false
  const consent = parseConsent(readCookie(document.cookie, COOKIE_CONSENT_NAME))
  return consent?.[category] === true
}

export type CookieKind =
  'Cookie' | 'Almacenamiento local' | 'Almacenamiento de sesión'

export interface CookieEntry {
  name: string
  kind: CookieKind
  purpose: string
  duration: string
  /** Who sets it; every entry today is first-party. */
  provider: string
}

/**
 * Everything the platform stores in the browser, by name. Keep it in step
 * with the code: the cookie policy page renders this table verbatim.
 */
export const ESSENTIAL_STORAGE: readonly CookieEntry[] = [
  {
    name: 'sb-*-auth-token',
    kind: 'Cookie',
    purpose:
      'Mantener tu sesión iniciada de forma segura (autenticación). Puede dividirse en varias partes (.0, .1).',
    duration: 'Hasta que cierres sesión',
    provider: 'Plataforma (Supabase Auth)',
  },
  {
    name: 'sb-*-auth-token-code-verifier',
    kind: 'Cookie',
    purpose:
      'Completar de forma segura el inicio de sesión con Google o enlaces de correo.',
    duration: 'Durante el inicio de sesión',
    provider: 'Plataforma (Supabase Auth)',
  },
  {
    name: 'tienda_location',
    kind: 'Cookie',
    purpose:
      'Recordar la dirección de entrega que elegiste para mostrar negocios y tiempos cercanos.',
    duration: '90 días',
    provider: 'Plataforma',
  },
  {
    name: 'tienda_guest_orders',
    kind: 'Cookie',
    purpose:
      'Permitirte seguir los pedidos que hiciste desde una mesa sin crear cuenta.',
    duration: '24 horas',
    provider: 'Plataforma',
  },
  {
    name: 'tienda_active_store',
    kind: 'Cookie',
    purpose: 'Recordar qué tienda administras en el panel de comercio.',
    duration: '1 año',
    provider: 'Plataforma',
  },
  {
    name: 'store_preview_theme_*',
    kind: 'Cookie',
    purpose:
      'Mostrar al comerciante la vista previa del diseño de su tienda antes de publicarlo.',
    duration: '1 hora',
    provider: 'Plataforma',
  },
  {
    name: COOKIE_CONSENT_NAME,
    kind: 'Cookie',
    purpose:
      'Guardar tus preferencias de cookies para no preguntarte en cada visita.',
    duration: '6 meses',
    provider: 'Plataforma',
  },
  {
    name: 'tienda_legal_pending',
    kind: 'Cookie',
    purpose:
      'Registrar que aceptaste los términos antes de iniciar sesión con Google.',
    duration: '10 minutos',
    provider: 'Plataforma',
  },
  {
    name: 'theme',
    kind: 'Almacenamiento local',
    purpose: 'Recordar si prefieres el modo claro u oscuro.',
    duration: 'Hasta que lo borres',
    provider: 'Plataforma',
  },
  {
    name: 'tienda-preferences',
    kind: 'Almacenamiento local',
    purpose:
      'Recordar tus ajustes de accesibilidad (tamaño de texto, contraste, movimiento).',
    duration: 'Hasta que lo borres',
    provider: 'Plataforma',
  },
  {
    name: 'tienda:sound',
    kind: 'Almacenamiento local',
    purpose: 'Recordar si activaste los sonidos de aviso de pedidos.',
    duration: 'Hasta que lo borres',
    provider: 'Plataforma',
  },
  {
    name: 'tienda:install-prompt-dismissed',
    kind: 'Almacenamiento local',
    purpose: 'No volver a sugerirte instalar la app si ya lo descartaste.',
    duration: 'Hasta que lo borres',
    provider: 'Plataforma',
  },
  {
    name: 'dashboard:sidebar-collapsed / tienda:theme-recent-colors',
    kind: 'Almacenamiento local',
    purpose:
      'Preferencias del panel de comercio (menú lateral y colores recientes).',
    duration: 'Hasta que lo borres',
    provider: 'Plataforma',
  },
  {
    name: 'checkout:just-placed',
    kind: 'Almacenamiento de sesión',
    purpose: 'Mostrar una sola vez la confirmación de un pedido recién hecho.',
    duration: 'Hasta cerrar la pestaña',
    provider: 'Plataforma',
  },
]
