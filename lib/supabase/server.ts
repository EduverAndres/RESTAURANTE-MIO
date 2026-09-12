import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { env, SUPABASE_PUBLIC_KEY } from '@/lib/env'
import type { Database } from '@/types/database'

// Server client for Server Components, Route Handlers and Server Actions.
// Always create a new instance per request; never cache it in a module scope.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_PUBLIC_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // The middleware refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  )
}
