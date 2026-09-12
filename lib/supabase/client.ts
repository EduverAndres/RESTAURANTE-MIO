'use client'

import { createBrowserClient } from '@supabase/ssr'
import { env, SUPABASE_PUBLIC_KEY } from '@/lib/env'
import type { Database } from '@/types/database'

// Browser client. Safe to call in client components; @supabase/ssr reuses a
// single instance per page.
export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_PUBLIC_KEY,
  )
}
