import {
  ArrowRightIcon,
  HeartIcon,
  RotateCcwIcon,
  StoreIcon,
} from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import { ForbiddenToast } from './forbidden-toast'
import {
  StoreGrid,
  categoriesOf,
  fetchStores,
  readVisitorLocation,
} from './store-grid'
import { AddressPicker } from '@/components/home/address-picker'
import { CategoryCarousel } from '@/components/home/category-carousel'
import { SearchBox } from '@/components/home/search-box'
import { FadeIn } from '@/components/motion/fade-in'
import { StoreCard, type StoreCardData } from '@/components/store/store-card'
import { StoreGridSkeleton } from '@/components/store/store-card-skeleton'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth'
import { APP_NAME } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface HomePageProps {
  searchParams: Promise<{ error?: string; categoria?: string }>
}

/** Stores the customer ordered from recently, most recent first. */
async function fetchReorderStores(
  userId: string,
  stores: StoreCardData[],
): Promise<StoreCardData[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('orders')
    .select('store_id, created_at')
    .eq('customer_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)
  const seen = new Set<string>()
  const ordered: StoreCardData[] = []
  for (const row of data ?? []) {
    if (seen.has(row.store_id)) continue
    seen.add(row.store_id)
    const store = stores.find((candidate) => candidate.id === row.store_id)
    if (store) ordered.push(store)
    if (ordered.length === 3) break
  }
  return ordered
}

async function StoreSections({ category }: { category: string | null }) {
  const [location, current] = await Promise.all([
    readVisitorLocation(),
    getCurrentUser(),
  ])
  const stores = await fetchStores(location)
  const categories = categoriesOf(stores)
  const favorites = stores.filter((store) => store.is_favorite)
  const reorder = current
    ? await fetchReorderStores(current.user.id, stores)
    : []

  return (
    <>
      <div className="mb-8 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchBox className="flex-1" />
          <AddressPicker initial={location} className="sm:max-w-xs" />
        </div>
        <CategoryCarousel categories={categories} />
      </div>

      {!category && reorder.length > 0 ? (
        <section aria-labelledby="reorder-title" className="mb-12">
          <div className="mb-4 flex items-center gap-2">
            <RotateCcwIcon aria-hidden="true" className="text-primary size-4" />
            <h2
              id="reorder-title"
              className="font-display text-2xl font-semibold"
            >
              Vuelve a pedir
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {reorder.map((store) => (
              <StoreCard key={store.id} store={store} />
            ))}
          </div>
        </section>
      ) : null}

      {!category && favorites.length > 0 ? (
        <section aria-labelledby="favorites-title" className="mb-12">
          <div className="mb-4 flex items-center gap-2">
            <HeartIcon aria-hidden="true" className="text-primary size-4" />
            <h2
              id="favorites-title"
              className="font-display text-2xl font-semibold"
            >
              Tus favoritos
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {favorites.map((store) => (
              <StoreCard key={store.id} store={store} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-primary text-sm font-medium">
            {location
              ? `Cerca de ${location.label || 'tu ubicación'}`
              : 'Mejor valorados'}
          </p>
          <h2
            id="restaurantes-title"
            className="font-display text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            {category ? category : 'Restaurantes para pedir hoy'}
          </h2>
        </div>
        <p className="text-muted-foreground max-w-sm text-sm">
          {location
            ? 'Ordenados por distancia, con tiempo estimado de llegada.'
            : 'Elige tu ubicación para ver distancias y tiempos de entrega.'}
        </p>
      </div>
      <StoreGrid stores={stores} category={category} />
    </>
  )
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { error, categoria } = await searchParams
  const category = categoria?.trim() || null

  return (
    <>
      <ForbiddenToast error={error} />

      <section className="container-page grid items-center gap-10 py-12 lg:grid-cols-[1.2fr_1fr] lg:py-20">
        <FadeIn className="space-y-7">
          <p className="rounded-pill bg-primary/10 text-primary inline-flex items-center gap-2 px-3 py-1 text-xs font-medium">
            <StoreIcon aria-hidden="true" className="size-3.5" />
            Restaurantes con identidad propia
          </p>
          <h1 className="font-display font-display-soft text-5xl leading-[0.95] font-semibold tracking-tight sm:text-6xl lg:text-7xl">
            Pide a tu restaurante favorito.
            <br />
            <span className="text-primary">Con su propia identidad.</span>
          </h1>
          <p className="text-muted-foreground max-w-xl text-lg">
            En {APP_NAME} cada restaurante tiene su tienda, sus colores y su
            carta. Tú eliges, pagas en dos toques y sigues el pedido en vivo.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="rounded-pill h-12 px-6 text-base"
            >
              <Link href="#restaurantes">Explorar restaurantes</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-pill h-12 px-6 text-base"
            >
              <Link href="/register?role=merchant">
                Tengo un restaurante
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </FadeIn>

        <FadeIn delay={0.15} className="hidden lg:block">
          <ul className="grid gap-4">
            {[
              {
                title: 'Dos toques',
                text: 'Dirección y pago guardados desde tu primera compra.',
              },
              {
                title: 'En vivo',
                text: 'Sigue tu pedido estado por estado y habla con el restaurante.',
              },
              {
                title: 'Sin intermediarios raros',
                text: 'Comisión clara del 6 % que el restaurante conoce.',
              },
            ].map((item, index) => (
              <li
                key={item.title}
                className="rounded-card bg-card shadow-soft ring-foreground/5 flex gap-4 p-5 ring-1"
                style={{ marginLeft: `${index * 24}px` }}
              >
                <span className="rounded-control bg-primary/10 font-display text-primary flex size-10 shrink-0 items-center justify-center text-lg font-semibold">
                  {index + 1}
                </span>
                <span>
                  <span className="font-display block text-xl font-semibold">
                    {item.title}
                  </span>
                  <span className="text-muted-foreground block text-sm">
                    {item.text}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </FadeIn>
      </section>

      <section
        id="restaurantes"
        className="container-page scroll-mt-24 pb-20"
        aria-labelledby="restaurantes-title"
      >
        <Suspense fallback={<StoreGridSkeleton />}>
          <StoreSections category={category} />
        </Suspense>
      </section>
    </>
  )
}
