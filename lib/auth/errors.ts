// Maps Supabase Auth errors to user-facing Spanish copy. Raw messages are
// never forwarded to the UI. No server imports: shared by actions and forms.
import type { CallbackErrorKey } from '@/lib/auth/callback'

export interface AuthErrorLike {
  code?: string | null
  message?: string | null
  status?: number | null
}

export const AUTH_ERROR_MESSAGES = {
  invalidCredentials: 'Correo o contraseña incorrectos.',
  emailNotConfirmed: 'Confirma tu correo electrónico antes de iniciar sesión.',
  alreadyRegistered: 'Ya existe una cuenta con este correo electrónico.',
  rateLimit: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  providerDisabled: 'Este método de acceso no está habilitado por ahora.',
  weakPassword: 'La contraseña es demasiado débil. Usa al menos 8 caracteres.',
  invalidToken: 'El código expiró o no es válido. Solicita uno nuevo.',
  linkExpired: 'El enlace expiró o ya fue usado. Solicita uno nuevo.',
  linkInvalid: 'No pudimos validar el enlace. Intenta de nuevo.',
  sessionMissing: 'Tu sesión expiró. Inicia sesión de nuevo.',
  unknown: 'No pudimos completar la solicitud. Inténtalo de nuevo.',
} as const

// Keys the auth callback puts in `/login?error=<key>` (see lib/auth/callback).
const CALLBACK_ERROR_MESSAGES: Record<CallbackErrorKey, string> = {
  expired: AUTH_ERROR_MESSAGES.linkExpired,
  invalid: AUTH_ERROR_MESSAGES.linkInvalid,
  callback: AUTH_ERROR_MESSAGES.linkInvalid,
  missing: AUTH_ERROR_MESSAGES.linkInvalid,
}

function isCallbackErrorKey(value: string): value is CallbackErrorKey {
  return Object.hasOwn(CALLBACK_ERROR_MESSAGES, value)
}

/** Copy for a callback error key, or null when the key is absent/unknown. */
export function callbackErrorMessage(
  key: string | null | undefined,
): string | null {
  if (!key || !isCallbackErrorKey(key)) return null
  return CALLBACK_ERROR_MESSAGES[key]
}

const CODE_MAP: Record<string, string> = {
  invalid_credentials: AUTH_ERROR_MESSAGES.invalidCredentials,
  email_not_confirmed: AUTH_ERROR_MESSAGES.emailNotConfirmed,
  user_already_exists: AUTH_ERROR_MESSAGES.alreadyRegistered,
  email_exists: AUTH_ERROR_MESSAGES.alreadyRegistered,
  phone_exists: AUTH_ERROR_MESSAGES.alreadyRegistered,
  over_request_rate_limit: AUTH_ERROR_MESSAGES.rateLimit,
  over_email_send_rate_limit: AUTH_ERROR_MESSAGES.rateLimit,
  over_sms_send_rate_limit: AUTH_ERROR_MESSAGES.rateLimit,
  provider_disabled: AUTH_ERROR_MESSAGES.providerDisabled,
  phone_provider_disabled: AUTH_ERROR_MESSAGES.providerDisabled,
  email_provider_disabled: AUTH_ERROR_MESSAGES.providerDisabled,
  signup_disabled: AUTH_ERROR_MESSAGES.providerDisabled,
  otp_disabled: AUTH_ERROR_MESSAGES.providerDisabled,
  sms_send_failed: AUTH_ERROR_MESSAGES.providerDisabled,
  weak_password: AUTH_ERROR_MESSAGES.weakPassword,
  otp_expired: AUTH_ERROR_MESSAGES.invalidToken,
  flow_state_expired: AUTH_ERROR_MESSAGES.invalidToken,
  flow_state_not_found: AUTH_ERROR_MESSAGES.invalidToken,
  bad_code_verifier: AUTH_ERROR_MESSAGES.invalidToken,
  session_not_found: AUTH_ERROR_MESSAGES.sessionMissing,
  session_expired: AUTH_ERROR_MESSAGES.sessionMissing,
}

const MESSAGE_MAP: ReadonlyArray<[RegExp, string]> = [
  [/invalid login credentials/i, AUTH_ERROR_MESSAGES.invalidCredentials],
  [/email not confirmed/i, AUTH_ERROR_MESSAGES.emailNotConfirmed],
  [/already registered|already exists/i, AUTH_ERROR_MESSAGES.alreadyRegistered],
  [/rate limit/i, AUTH_ERROR_MESSAGES.rateLimit],
  [
    /unsupported provider|provider is not enabled|signups not allowed|not enabled/i,
    AUTH_ERROR_MESSAGES.providerDisabled,
  ],
  [/password should|weak password/i, AUTH_ERROR_MESSAGES.weakPassword],
  [/expired|invalid.*token|token.*invalid/i, AUTH_ERROR_MESSAGES.invalidToken],
  [/auth session missing/i, AUTH_ERROR_MESSAGES.sessionMissing],
]

export function mapAuthError(error: AuthErrorLike | null | undefined): string {
  if (!error) return AUTH_ERROR_MESSAGES.unknown

  if (error.code && CODE_MAP[error.code]) return CODE_MAP[error.code]
  if (error.status === 429) return AUTH_ERROR_MESSAGES.rateLimit

  const message = error.message ?? ''
  for (const [pattern, copy] of MESSAGE_MAP) {
    if (pattern.test(message)) return copy
  }
  return AUTH_ERROR_MESSAGES.unknown
}
