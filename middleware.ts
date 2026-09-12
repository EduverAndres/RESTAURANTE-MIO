import { NextResponse, type NextRequest } from 'next/server'
import { resolveUserRole } from '@/lib/auth/resolve-role'
import { canAccess, requiredRolesFor } from '@/lib/auth/roles'
import { env } from '@/lib/env'
import { requestOrigin } from '@/lib/http/request-origin'
import { rewriteForStore, storeSlugFromHost } from '@/lib/subdomain'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { supabase, response, user } = await updateSession(request)
  const { pathname, search } = request.nextUrl

  // Store subdomains (`<slug>.<root>`) transparently render the `/t/<slug>`
  // storefront routes. The rewrite happens before the role gate so it never
  // interferes with app-wide paths (auth, dashboard, admin, …), which
  // `rewriteForStore` leaves untouched.
  const slug = storeSlugFromHost(
    request.headers.get('host'),
    env.NEXT_PUBLIC_ROOT_DOMAIN,
  )
  if (slug) {
    const rewritten = rewriteForStore(pathname, slug)
    if (rewritten !== pathname) {
      const url = request.nextUrl.clone()
      url.pathname = rewritten
      const rewriteResponse = NextResponse.rewrite(url, { request })
      response.cookies
        .getAll()
        .forEach((cookie) => rewriteResponse.cookies.set(cookie))
      return rewriteResponse
    }
  }

  const required = requiredRolesFor(pathname)
  if (required === null) return response

  // Redirects are built from the origin the browser used (host header /
  // proxy headers), not `nextUrl.origin`, which under `next dev -H 0.0.0.0`
  // or behind a proxy is the server bind address and would send the browser
  // to a host that never received the session cookies.
  const origin = requestOrigin(request.headers, env.NEXT_PUBLIC_SITE_URL)

  // A redirect must carry any cookies rotated by updateSession, otherwise a
  // refreshed token is dropped and the next request fails with a stale one.
  const redirectWithSession = (url: URL) => {
    const redirect = NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }

  if (!user) {
    const loginUrl = new URL('/login', origin)
    loginUrl.searchParams.set('next', `${pathname}${search}`)
    return redirectWithSession(loginUrl)
  }

  // Paths that only require authentication never need the role, so skip the
  // (possible) profile lookup for them.
  const role =
    required.length > 0 ? await resolveUserRole(supabase, user) : 'customer'

  const decision = canAccess(pathname, role)
  if (!decision.allowed) {
    const homeUrl = new URL('/', origin)
    homeUrl.searchParams.set('error', 'forbidden')
    return redirectWithSession(homeUrl)
  }

  return response
}

export const config = {
  matcher: [
    // Skip static assets, images, the manifest, the service worker, the
    // offline fallback and generated icons; everything else refreshes the
    // session so server components see a current user.
    '/((?!_next/static|_next/image|favicon\\.ico|manifest|sw\\.js|offline|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)',
  ],
}
