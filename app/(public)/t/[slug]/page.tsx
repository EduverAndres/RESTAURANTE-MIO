import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { storeUrl } from '@/lib/env'
import { serializeJsonLd, storeJsonLd } from '@/lib/seo/store-jsonld'
import { Storefront, fetchStore } from './storefront'

function canonicalOf(slug: string): string {
  return storeUrl(slug)
}

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
    alternates: { canonical: canonicalOf(store.slug) },
  }
}

export default async function StorePage({ params }: StorePageProps) {
  const { slug } = await params
  const store = await fetchStore(slug)
  if (!store) notFound()

  return (
    <>
      {/* What the business is, where and when, for search engines. Built
          only from what the merchant filled in; escaped against `</script>`. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(storeJsonLd(store, canonicalOf(store.slug))),
        }}
      />
      <Storefront store={store} />
    </>
  )
}
