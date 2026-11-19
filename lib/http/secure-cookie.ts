import 'server-only'

import { headers } from 'next/headers'
import { env } from '@/lib/env'
import { isSecureRequest } from '@/lib/http/request-origin'

/** `secure` flag for a cookie set during this request (see isSecureRequest). */
export async function secureCookieFlag(): Promise<boolean> {
  return isSecureRequest(await headers(), env.NEXT_PUBLIC_SITE_URL)
}
