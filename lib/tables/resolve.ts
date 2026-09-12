import type { SupabaseClient } from '@supabase/supabase-js'
import { isTableToken } from '@/lib/tables/qr'
import type { Store } from '@/types/app'
import type { Database } from '@/types/database'

export interface ResolvedTable {
  store: Store
  table: { id: string; number: number; token: string }
}

/**
 * Resolves a table from the public QR token, scoped to the store slug in the
 * URL. store_tables has no public SELECT policy (tokens must not be listable),
 * so the lookup goes through the security definer `resolve_store_table` RPC,
 * which only answers for an exact slug + token pair of an active store. The
 * store row itself is publicly readable while active.
 *
 * Kept free of server-only imports so it can run against a fake client in
 * unit tests; `fetchTableByToken` in `lib/tables/server.ts` wires the real one.
 */
export async function resolveTableWithClient(
  supabase: SupabaseClient<Database>,
  slug: string,
  token: string,
): Promise<ResolvedTable | null> {
  if (!isTableToken(token)) return null
  const { data: matches, error } = await supabase.rpc('resolve_store_table', {
    store_slug: slug,
    token,
  })
  if (error) {
    console.error('Failed to resolve table token', error)
    return null
  }
  const match = matches?.[0]
  if (!match) return null

  const { data: store } = await supabase
    .from('stores')
    .select('*')
    .eq('id', match.store_id)
    .eq('status', 'active')
    .maybeSingle()
  if (!store) return null

  // The token is the one that matched, so it is returned as received.
  return {
    store,
    table: { id: match.id, number: match.number, token },
  }
}
