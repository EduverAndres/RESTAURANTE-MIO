import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Storefront, fetchStore } from './storefront'

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
  return {
    title: store.name,
    description:
      store.description ?? `Pide en ${store.name}: domicilio, recogida o mesa.`,
    openGraph: store.cover_url ? { images: [store.cover_url] } : undefined,
  }
}

export default async function StorePage({ params }: StorePageProps) {
  const { slug } = await params
  const store = await fetchStore(slug)
  if (!store) notFound()

  return <Storefront store={store} />
}
