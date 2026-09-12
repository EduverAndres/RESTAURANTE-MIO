// Single rule for a verified user's role, shared by the middleware (edge),
// route handlers, server actions and server components. Must stay free of
// Node-only and server-only imports.
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { isUserRole } from '@/lib/auth/roles'
import type { UserRole } from '@/types/app'
import type { Database } from '@/types/database'

/**
 * Role for a verified user: the `app_metadata.role` claim mirrored by the
 * database trigger, falling back to a `profiles` lookup for sessions issued
 * before the claim existed (or whose claim has not been mirrored yet), and
 * finally `customer` so nobody gains elevated access by accident.
 */
export async function resolveUserRole(
  supabase: SupabaseClient<Database>,
  user: User,
): Promise<UserRole> {
  const claim = user.app_metadata?.role
  if (isUserRole(claim)) return claim

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    // A failed lookup must not look like "no profile": log it so a merchant
    // silently landing on the customer home is traceable.
    console.error('[auth] profiles role lookup failed', {
      userId: user.id,
      code: error.code,
      message: error.message,
    })
    return 'customer'
  }

  return profile?.role ?? 'customer'
}
