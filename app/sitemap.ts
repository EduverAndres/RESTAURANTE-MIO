import type { MetadataRoute } from 'next'
import { env, storeUrl } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

const STATIC_PATHS = [
  '/',
  '/para-restaurantes',
  '/terminos',
  '/terminos-aliados',
  '/privacidad',
  '/cookies',
  '/proteccion-al-consumidor',
  '/legal',
] as const

/**
 * Every public page plus one entry per active store, at the same address the
 * storefront declares as canonical. A failed store query still returns the
 * static pages: a sitemap missing its stores for an hour beats a 500 that
 * search engines remember.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '')
  const pages: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${site}${path === '/' ? '' : path}`,
  }))

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('stores')
      .select('slug, updated_at')
      .eq('status', 'active')
    if (error || !data) return pages

    return [
      ...pages,
      ...data.map((store) => ({
        url: storeUrl(store.slug),
        lastModified: store.updated_at,
      })),
    ]
  } catch {
    return pages
  }
}
