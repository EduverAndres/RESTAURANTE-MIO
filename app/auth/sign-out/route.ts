import { NextResponse, type NextRequest } from 'next/server'
import { env } from '@/lib/env'
import { requestOrigin } from '@/lib/http/request-origin'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const origin = requestOrigin(request.headers, env.NEXT_PUBLIC_SITE_URL)
  // 303 turns the POST into a GET on the landing page.
  return NextResponse.redirect(new URL('/', origin), 303)
}
