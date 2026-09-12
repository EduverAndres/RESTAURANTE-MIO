import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { env, SUPABASE_PUBLIC_KEY } from '@/lib/env'
import type { Database } from '@/types/database'

// Refreshes the auth session on every request and mirrors any rotated
// cookies onto the outgoing response. Meant to be called from middleware.ts.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_PUBLIC_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // getUser() validates the JWT against Supabase Auth; do not replace it
  // with getSession(), which trusts the cookie without verification.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { supabase, response, user }
}
