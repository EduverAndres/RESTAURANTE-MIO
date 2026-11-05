import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { env } from '@/lib/env'
import { storePublicUrl } from '@/lib/subdomain'
import { Storefront, fetchStore } from './storefront'

// No `loading.tsx` on purpose: it would wrap the page in a Suspense boundary,
// flush a 200 shell, and turn a missing store into a soft 404. The sections
// stream individually instead (see storefront.tsx).

export const dynamic = 'force-dynamic'

interface StorePageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: StorePageProps): Promise<Metadata> {
  const { slug } = await params
  const store = await fetchStore(slug)
  if (!store) return { title: 'Tienda no encontrada' }
  // `openGraph.images` is deliberately absent: setting it here would override
  // the generated per-store card in opengraph-image.tsx, which carries the
  // brand colour, the logo and the name instead of a bare cover photo.
  return {
    title: store.name,
    description:
      store.description ?? `Pide en ${store.name}: domicilio, recogida o mesa.`,
    // The same storefront answers on `/t/<slug>` and on its subdomain. The
    // canonical is the address the merchant shares from the dashboard, so the
    // links pointing at the store and the URL search engines keep agree.
    alternates: {
      canonical: storePublicUrl({
        slug: store.slug,
        siteUrl: env.NEXT_PUBLIC_SITE_URL,
        rootDomain: env.NEXT_PUBLIC_ROOT_DOMAIN,
      }),
    },
  }
}

export default async function StorePage({ params }: StorePageProps) {
  const { slug } = await params
  const store = await fetchStore(slug)
  if (!store) notFound()

  return <Storefront store={store} />
}
