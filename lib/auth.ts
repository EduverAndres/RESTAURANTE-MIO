import 'server-only'

import type { Session, User } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { resolveUserRole } from '@/lib/auth/resolve-role'
import { getRoleHome } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import type { Profile, UserRole } from '@/types/app'

export { getRoleHome }

export interface CurrentUser {
  user: User
  profile: Profile | null
  role: UserRole
}

/** Raw session from the cookie. Prefer getCurrentUser for authorisation. */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session
}

/**
 * Verified user plus profile. Memoised per request with React cache so
 * layouts and pages can call it freely without extra roundtrips. The role
 * follows the one shared rule (claim first, profiles fallback, customer
 * default) so it never disagrees with the middleware or the auth callback.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: profile }, role] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    resolveUserRole(supabase, user),
  ])

  return { user, profile: profile ?? null, role }
})

/** Redirects anonymous visitors to the login page, preserving the target. */
export async function requireUser(next?: string): Promise<CurrentUser> {
  const current = await getCurrentUser()
  if (!current) {
    const query = next ? `?next=${encodeURIComponent(next)}` : ''
    redirect(`/login${query}`)
  }
  return current
}

/** Like requireUser, but also enforces one of the given roles. */
export async function requireRole(
  roles: UserRole[],
  next?: string,
): Promise<CurrentUser> {
  const current = await requireUser(next)
  if (!roles.includes(current.role)) {
    redirect('/?error=forbidden')
  }
  return current
}
