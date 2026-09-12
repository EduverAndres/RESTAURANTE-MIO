import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import type { Database } from '@/types/database'

// Service-role client. Bypasses RLS: use only in trusted server code
// (webhooks, admin jobs) and never expose its key to the browser.
export function createAdminClient() {
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!secretKey) {
    throw new Error(
      'Missing SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) for the admin client',
    )
  }

  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    secretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
