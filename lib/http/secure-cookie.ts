import 'server-only'

import { headers } from 'next/headers'
import { siteUrl } from '@/lib/site-url'
import { isSecureRequest } from '@/lib/http/request-origin'

/** `secure` flag for a cookie set during this request (see isSecureRequest). */
export async function secureCookieFlag(): Promise<boolean> {
  return isSecureRequest(await headers(), siteUrl())
}
