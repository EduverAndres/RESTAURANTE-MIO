// Pure decision logic for /auth/callback. Interprets the query string GoTrue
// (or our own email templates) send us and decides what the route handler
// must do, without touching Supabase. No server imports: reused client-side
// to read the error fragment GoTrue leaves in the URL hash.
import { safeNextPath } from '@/lib/auth/safe-next'

/** Error keys surfaced as `/login?error=<key>`; copy lives in lib/auth/errors. */
export type CallbackErrorKey = 'expired' | 'invalid' | 'callback' | 'missing'

export const EMAIL_OTP_TYPES = [
  'signup',
  'email',
  'recovery',
  'magiclink',
  'email_change',
  'invite',
] as const
export type EmailOtpType = (typeof EMAIL_OTP_TYPES)[number]

export type CallbackResolution =
  | { kind: 'error'; code: CallbackErrorKey }
  | {
      kind: 'token'
      tokenHash: string
      type: EmailOtpType
      next: string | null
    }
  | { kind: 'code'; code: string; next: string | null }

// GoTrue `error_code` values (query or hash) and supabase-js `error.code`
// values share the same vocabulary, so one map serves both.
const ERROR_CODE_MAP: Record<string, CallbackErrorKey> = {
  otp_expired: 'expired',
  flow_state_expired: 'expired',
  access_denied: 'invalid',
  bad_code_verifier: 'invalid',
  flow_state_not_found: 'invalid',
  otp_disabled: 'invalid',
  validation_failed: 'invalid',
}

export function mapCallbackErrorCode(
  code: string | null | undefined,
): CallbackErrorKey {
  if (!code) return 'callback'
  return ERROR_CODE_MAP[code] ?? 'callback'
}

/**
 * Error key when the params carry a GoTrue error (`error` and/or
 * `error_code`), otherwise null. `error_code` is the precise one; `error`
 * alone (e.g. `access_denied`) is a coarser fallback.
 */
export function callbackErrorFromParams(
  params: URLSearchParams,
): CallbackErrorKey | null {
  const errorCode = params.get('error_code')
  const error = params.get('error')
  if (!errorCode && !error) return null
  return mapCallbackErrorCode(errorCode || error)
}

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return (
    value !== null && (EMAIL_OTP_TYPES as readonly string[]).includes(value)
  )
}

export function resolveCallback(params: URLSearchParams): CallbackResolution {
  const errorKey = callbackErrorFromParams(params)
  if (errorKey) return { kind: 'error', code: errorKey }

  const next = safeNextPath(params.get('next'))

  const tokenHash = params.get('token_hash')
  if (tokenHash) {
    const type = params.get('type')
    if (!isEmailOtpType(type)) return { kind: 'error', code: 'invalid' }
    return { kind: 'token', tokenHash, type, next }
  }

  const code = params.get('code')
  if (code) return { kind: 'code', code, next }

  return { kind: 'error', code: 'missing' }
}

/**
 * Absolute `emailRedirectTo` / `redirectTo` for Supabase email flows. The
 * `?next=` query is always present so the email templates can append
 * `&token_hash=...&type=...` unconditionally.
 */
export function buildAuthRedirectUrl(
  siteUrl: string,
  next: string | null | undefined,
): string {
  const base = siteUrl.replace(/\/+$/, '')
  const target = safeNextPath(next) ?? '/'
  return `${base}/auth/callback?next=${encodeURIComponent(target)}`
}
