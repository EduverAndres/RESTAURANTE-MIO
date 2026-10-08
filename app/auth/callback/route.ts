import { NextResponse, type NextRequest } from 'next/server'
import { mapCallbackErrorCode, resolveCallback } from '@/lib/auth/callback'
import { resolveUserRole } from '@/lib/auth/resolve-role'
import { getRoleHome } from '@/lib/auth/roles'
import { env } from '@/lib/env'
import { requestOrigin } from '@/lib/http/request-origin'
import { LEGAL_PENDING_COOKIE, LEGAL_VERSION } from '@/lib/legal/consent'
import { recordLegalAcceptance } from '@/lib/legal/record'
import { createClient } from '@/lib/supabase/server'

// Completes email confirmation, magic-link, password-recovery, invite and
// OAuth flows. Two shapes reach us:
//   - `token_hash` + `type`: links rendered by our email templates. They are
//     verified server-side, so they work from any device or browser.
//   - `code`: PKCE exchange (OAuth, or links that used the default template).
//     The code verifier lives in a cookie set by the browser client, so it
//     only works in the browser that started the flow.
// Redirects are built from the origin the browser used, never from the
// server bind address, so the session cookies land on the right host.
export async function GET(request: NextRequest) {
  const origin = requestOrigin(request.headers, env.NEXT_PUBLIC_SITE_URL)
  const fail = (key: string) =>
    NextResponse.redirect(`${origin}/login?error=${key}`)

  const resolution = resolveCallback(request.nextUrl.searchParams)
  if (resolution.kind === 'error') return fail(resolution.code)

  const supabase = await createClient()
  const { data, error } =
    resolution.kind === 'token'
      ? await supabase.auth.verifyOtp({
          token_hash: resolution.tokenHash,
          type: resolution.type,
        })
      : await supabase.auth.exchangeCodeForSession(resolution.code)

  if (error || !data.session) {
    console.error('auth callback failed', error)
    return fail(mapCallbackErrorCode(error?.code))
  }

  // An OAuth sign-in started from the login form, where the person ticked
  // the acceptance box: the browser left this marker before redirecting.
  // Without it the middleware gate asks on the next request instead.
  // `<version>` or `<version>.m` (the sign-up form's optional marketing box).
  const pending = request.cookies.get(LEGAL_PENDING_COOKIE)?.value
  if (pending?.split('.')[0] === LEGAL_VERSION) {
    const provider = data.session.user.app_metadata?.provider
    await recordLegalAcceptance({
      supabase,
      user: data.session.user,
      source: provider === 'azure' ? 'login-microsoft' : 'login-google',
      headers: request.headers,
      marketingOptIn: pending.endsWith('.m') ? true : undefined,
    })
  }

  const destination =
    resolution.next ??
    getRoleHome(await resolveUserRole(supabase, data.session.user))
  const response = NextResponse.redirect(`${origin}${destination}`)
  if (pending) response.cookies.delete(LEGAL_PENDING_COOKIE)
  return response
}
