import { NextResponse, type NextRequest } from 'next/server'
import { requestOrigin } from '@/lib/http/request-origin'
import { siteUrl } from '@/lib/site-url'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  // Revokes this session in Supabase Auth (not just this browser's cookies),
  // and the server client clears the auth cookies on the response.
  //
  // Only this one: supabase-js defaults to `scope: 'global'`, which ends
  // every session of the account on every device. The other browsers kept
  // looking signed in until their next server request, often a live refresh
  // (a store answering a reservation), and then landed on the login page.
  await supabase.auth.signOut({ scope: 'local' })
  // The site's own origin (see lib/site-url): never a stale or foreign host.
  const origin = requestOrigin(request.headers, siteUrl())
  // 303 turns the POST into a GET on the landing page.
  const response = NextResponse.redirect(new URL('/', origin), 303)
  response.headers.set('Cache-Control', 'no-store')
  return response
}
