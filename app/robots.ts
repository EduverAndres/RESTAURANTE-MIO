import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site-url'

/**
 * Public pages are the home, the owner landing, the legal pages and every
 * storefront. Everything behind a session, a payment or a table token stays
 * out of the index: those pages are personal, and a crawler following a
 * table link would only find a QR flow meant for someone sitting there.
 */
export default function robots(): MetadataRoute.Robots {
  const site = siteUrl()

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/account',
        '/admin',
        '/api/',
        '/auth/',
        '/checkout',
        '/courier',
        '/dashboard',
        '/mesa/',
        '/orders',
        '/t/*/mesa/',
        '/t/*/preview',
      ],
    },
    sitemap: `${site}/sitemap.xml`,
  }
}
