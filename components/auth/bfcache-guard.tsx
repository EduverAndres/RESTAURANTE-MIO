'use client'

import { useEffect } from 'react'

/**
 * Private pages must not come back from the browser's back/forward cache.
 *
 * After "Cerrar sesión" the session is revoked and the cookies are gone, but
 * pressing Atrás can restore the dashboard exactly as it was from memory
 * (bfcache), without a single request reaching the server, so the middleware
 * never gets a chance to send the visitor to the login page. A restored page
 * reloads itself instead; with no session, that reload lands on /login.
 */
export function BfcacheGuard() {
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) window.location.reload()
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])
  return null
}
