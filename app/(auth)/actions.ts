'use server'

import { buildAuthRedirectUrl } from '@/lib/auth/callback'
import { mapAuthError } from '@/lib/auth/errors'
import { resolveUserRole } from '@/lib/auth/resolve-role'
import { getRoleHome } from '@/lib/auth/roles'
import { safeNextPath } from '@/lib/auth/safe-next'
import { env } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'
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
  return buildAuthRedirectUrl(env.NEXT_PUBLIC_SITE_URL, next)
}

export async function signInWithPassword(
  input: LoginInput,
  next?: string | null,
): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = loginSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: INVALID_INPUT }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error || !data.user) return { ok: false, error: mapAuthError(error) }

  // The claim may not be mirrored yet for freshly created accounts, so fall
  // back to the profile row rather than sending a merchant to the home page.
  const role = await resolveUserRole(supabase, data.user)
  const redirectTo = safeNextPath(next) ?? getRoleHome(role)
  return { ok: true, redirectTo }
}

export async function signUp(
  input: RegisterInput,
): Promise<ActionResult<{ redirectTo: string | null; email: string }>> {
  const parsed = registerSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: INVALID_INPUT }

  const { email, password, full_name, phone, role } = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name, phone: phone ?? null, role },
      emailRedirectTo: authRedirectUrl(getRoleHome(role)),
    },
  })
  if (error) return { ok: false, error: mapAuthError(error) }

  // Supabase returns a user with an empty identities list when the email is
  // already registered and confirmation is enabled, to avoid enumeration.
  if (data.user && data.user.identities?.length === 0) {
    return { ok: false, error: mapAuthError({ code: 'user_already_exists' }) }
  }

  return {
    ok: true,
    email,
    redirectTo: data.session ? getRoleHome(role) : null,
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

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo: authRedirectUrl('/account/reset-password') },
  )
  // Rate limits are surfaced; anything else stays silent to avoid leaking
  // whether the address exists.
  if (error && error.status === 429)
    return { ok: false, error: mapAuthError(error) }
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
  return { ok: true }
}
