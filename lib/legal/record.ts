import 'server-only'

import { isIP } from 'node:net'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { clientIp } from '@/lib/http/client-ip'
import {
  hasAcceptedCurrent,
  LEGAL_VERSION,
  legalMetadata,
  type ConsentSource,
} from '@/lib/legal/consent'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/types/database'

/**
 * Records that `user` accepted the current legal documents.
 *
 * Two writes, for two jobs:
 *   1. The user's auth metadata, which the middleware gate reads for free on
 *      every request. Written with the user's own session.
 *   2. A row in `legal_consents`, the append-only evidence (version, time,
 *      IP, browser) the law asks the controller to keep. Written with the
 *      service role so no client can forge or erase it.
 *
 * The evidence write never blocks the person: if it fails (for example the
 * migration has not been applied yet) it is logged loudly and the session
 * goes on — refusing someone who just said yes would be the wrong failure.
 *
 * Skips both writes when the current version is already on record and there
 * is no new marketing choice to store, so a login does not log a duplicate.
 */
export async function recordLegalAcceptance({
  supabase,
  user,
  source,
  headers,
  marketingOptIn,
}: {
  supabase: SupabaseClient<Database>
  user: User
  source: ConsentSource
  headers: Headers
  marketingOptIn?: boolean
}): Promise<{ ok: boolean }> {
  if (hasAcceptedCurrent(user.user_metadata) && marketingOptIn === undefined) {
    return { ok: true }
  }

  const { error } = await supabase.auth.updateUser({
    data: legalMetadata(source, marketingOptIn),
  })
  if (error) {
    console.error('legal consent: metadata update failed', error)
    return { ok: false }
  }

  await logConsent({
    userId: user.id,
    source,
    headers,
    marketingOptIn: marketingOptIn ?? null,
  })
  return { ok: true }
}

/** The evidence row alone, for flows that already wrote the metadata. */
export async function logConsent({
  userId,
  source,
  headers,
  marketingOptIn,
}: {
  userId: string
  source: ConsentSource
  headers: Headers
  marketingOptIn: boolean | null
}): Promise<void> {
  const ip = clientIp(headers)
  try {
    const { error } = await createAdminClient()
      .from('legal_consents')
      .insert({
        user_id: userId,
        document_version: LEGAL_VERSION,
        source,
        marketing_opt_in: marketingOptIn,
        // `inet` rejects anything that is not an address; a malformed proxy
        // header must not cost us the whole record.
        ip: ip && isIP(ip) ? ip : null,
        user_agent: headers.get('user-agent')?.slice(0, 500) ?? null,
      })
    if (error) console.error('legal consent: evidence insert failed', error)
  } catch (cause) {
    console.error('legal consent: evidence insert failed', cause)
  }
}
