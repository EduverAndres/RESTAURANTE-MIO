'use server'

import { headers } from 'next/headers'
import { after } from 'next/server'
import { buildAuthRedirectUrl } from '@/lib/auth/callback'
import { AUTH_ERROR_MESSAGES, mapAuthError } from '@/lib/auth/errors'
import { resolveUserRole } from '@/lib/auth/resolve-role'
import { getRoleHome } from '@/lib/auth/roles'
import { safeNextPath } from '@/lib/auth/safe-next'
import { siteUrl } from '@/lib/site-url'
import { clientIp } from '@/lib/http/client-ip'
import { legalMetadata, type ConsentSource } from '@/lib/legal/consent'
import { logConsent, recordLegalAcceptance } from '@/lib/legal/record'
import { logger } from '@/lib/log/logger'
import {
  checkAuthRateLimit,
  type AuthRateLimitAction,
} from '@/lib/rate-limit/auth'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/app'
import {
  emailSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
} from '@/lib/validations/auth'

export type ActionResult<T extends object = Record<never, never>> =
  ({ ok: true } & T) | { ok: false; error: string }

const INVALID_INPUT = 'Revisa los datos ingresados.'

// Where Supabase sends the user after an email link. Always carries `?next=`
// so the email templates can append `&token_hash=...&type=...`.
function authRedirectUrl(next: string | null | undefined): string {
  return buildAuthRedirectUrl(siteUrl(), next)
}

/**
 * Spends the per-account / per-address budget of an auth action. Returns the
 * copy to show when the budget is exhausted, null when the action may run.
 */
async function rateLimitError(
  action: AuthRateLimitAction,
  email: string,
): Promise<string | null> {
  const decision = await checkAuthRateLimit(action, {
    email,
    ip: clientIp(await headers()),
  })
  return decision.allowed ? null : AUTH_ERROR_MESSAGES.rateLimit
}

export async function signInWithPassword(
  input: LoginInput,
  next?: string | null,
): Promise<ActionResult<{ redirectTo: string; role: UserRole }>> {
  const parsed = loginSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: INVALID_INPUT }

  const limited = await rateLimitError('login', parsed.data.email)
  if (limited) return { ok: false, error: limited }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })
  if (error || !data.user) return { ok: false, error: mapAuthError(error) }

  // The form only submits with the box ticked; this records it (once per
  // document version) so the middleware gate lets the session through.
  await recordLegalAcceptance({
    supabase,
    user: data.user,
    source: 'login-password',
    headers: await headers(),
  })

  // The claim may not be mirrored yet for freshly created accounts, so fall
  // back to the profile row rather than sending a merchant to the home page.
  const role = await resolveUserRole(supabase, data.user)
  const redirectTo = safeNextPath(next) ?? getRoleHome(role)
  // The role travels back for the welcome screen; it was already resolved
  // for the redirect, so no extra query.
  return { ok: true, redirectTo, role }
}

/**
 * `next` is where the visitor was going (a cart on its way to /checkout, a
 * table guest's store). It used to be dropped here, so a customer who signed
 * up from "Ir a pagar" confirmed the email and landed on the home page.
 */
export async function signUp(
  input: RegisterInput,
  next?: string | null,
): Promise<ActionResult<{ redirectTo: string | null; email: string }>> {
  const parsed = registerSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: INVALID_INPUT }

  const { email, password, full_name, phone, role, marketing_opt_in } =
    parsed.data
  const landing = safeNextPath(next) ?? getRoleHome(role)

  const limited = await rateLimitError('signup', email)
  if (limited) return { ok: false, error: limited }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // The acceptance travels with the account from its first second, so a
      // new user is never stopped by the gate after confirming the email.
      data: {
        full_name,
        phone: phone ?? null,
        role,
        ...legalMetadata('register', marketing_opt_in),
      },
      emailRedirectTo: authRedirectUrl(landing),
    },
  })
  if (error) return { ok: false, error: mapAuthError(error) }

  // Supabase returns a user with an empty identities list when the email is
  // already registered and confirmation is enabled, to avoid enumeration.
  if (data.user && data.user.identities?.length === 0) {
    return { ok: false, error: mapAuthError({ code: 'user_already_exists' }) }
  }

  if (data.user) {
    // The evidence row is written after the response is sent: the person
    // waits only for Supabase (which sends the confirmation email inside
    // that call), not for one more database round trip. The acceptance
    // itself already travels in the account metadata above.
    const userId = data.user.id
    const requestHeaders = await headers()
    after(() =>
      logConsent({
        userId,
        source: 'register',
        headers: requestHeaders,
        marketingOptIn: marketing_opt_in,
      }),
    )
  }

  return {
    ok: true,
    email,
    redirectTo: data.session ? landing : null,
  }
}

/**
 * Sends the sign-up confirmation email again. `next` is the path the link
 * should land on after verification (normally the role home).
 */
export async function resendConfirmation(
  email: string,
  next?: string | null,
): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(email)
  if (!parsed.success) return { ok: false, error: INVALID_INPUT }

  const limited = await rateLimitError('email', parsed.data)
  if (limited) return { ok: false, error: limited }

  const supabase = await createClient()
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: parsed.data,
    options: { emailRedirectTo: authRedirectUrl(next) },
  })
  if (error) {
    console.error('resendConfirmation failed', error)
    return { ok: false, error: mapAuthError(error) }
  }
  return { ok: true }
}

export async function requestPasswordReset(
  input: ForgotPasswordInput,
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: INVALID_INPUT }

  // The budget is spent for unknown addresses too, so being throttled says
  // nothing about whether an account exists.
  const limited = await rateLimitError('email', parsed.data.email)
  if (limited) return { ok: false, error: limited }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo: authRedirectUrl('/account/reset-password') },
  )
  // Rate limits are surfaced; anything else stays silent to avoid leaking
  // whether the address exists. It is still logged (without the address) so
  // a broken SMTP setup does not fail unnoticed.
  if (error && error.status === 429)
    return { ok: false, error: mapAuthError(error) }
  if (error) {
    logger.error(
      'auth.recovery.send_failed',
      { code: error.code, status: error.status },
      error,
    )
  }
  return { ok: true }
}

export async function updatePassword(
  input: ResetPasswordInput,
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: INVALID_INPUT }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })
  if (error) return { ok: false, error: mapAuthError(error) }
  // GoTrue itself ends every other session of the user when the password
  // changes (checked by e2e/auth.spec.ts), so nothing else to revoke here.
  return { ok: true }
}

/**
 * Records acceptance of the current legal documents for the signed-in user:
 * the "Aceptar y continuar" button of the gate page, and the SMS login,
 * whose session is created in the browser.
 */
export async function acceptLegalTerms(
  source: Extract<ConsentSource, 'gate' | 'login-sms'>,
  next?: string | null,
): Promise<ActionResult<{ redirectTo: string; role: UserRole }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    return { ok: false, error: 'Tu sesión expiró. Inicia sesión de nuevo.' }

  const result = await recordLegalAcceptance({
    supabase,
    user,
    source,
    headers: await headers(),
  })
  if (!result.ok) {
    return {
      ok: false,
      error: 'No pudimos guardar tu aceptación. Inténtalo de nuevo.',
    }
  }

  const role = await resolveUserRole(supabase, user)
  return {
    ok: true,
    redirectTo: safeNextPath(next) ?? getRoleHome(role),
    role,
  }
}
