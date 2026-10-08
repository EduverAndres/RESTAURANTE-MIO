import 'server-only'

import { env, SUPABASE_PUBLIC_KEY } from '@/lib/env'

export interface AuthProviders {
  google: boolean
  /** Microsoft accounts (Outlook, Hotmail, Office 365): `azure` in Supabase. */
  microsoft: boolean
  phone: boolean
}

/** What we show when the answer is unknown: only what always works. */
const SAFE_DEFAULT: AuthProviders = {
  google: false,
  microsoft: false,
  phone: false,
}

/**
 * Which sign-in methods the Supabase project actually has switched on.
 *
 * A button for a provider that is off sends the person to a raw JSON error
 * from GoTrue ("Unsupported provider: provider is not enabled"), which is
 * the worst possible first impression of a login screen. GoTrue publishes
 * its switches at `/auth/v1/settings`, so the login page asks first and
 * renders only the ways in that will work. Cached for five minutes: turning
 * a provider on in the dashboard shows up without a deploy.
 */
export async function getAuthProviders(): Promise<AuthProviders> {
  try {
    const response = await fetch(
      `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`,
      {
        headers: { apikey: SUPABASE_PUBLIC_KEY },
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(3000),
      },
    )
    if (!response.ok) return SAFE_DEFAULT
    const settings = (await response.json()) as {
      external?: Record<string, boolean>
    }
    return {
      google: settings.external?.google === true,
      microsoft: settings.external?.azure === true,
      phone: settings.external?.phone === true,
    }
  } catch {
    return SAFE_DEFAULT
  }
}
