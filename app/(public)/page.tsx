import { HeartIcon, RotateCcwIcon } from 'lucide-react'
import { Suspense } from 'react'
import { SiteFooter } from '@/components/layout/site-footer'
import { ForbiddenToast } from './forbidden-toast'
import {
  StoreGrid,
  categoriesOf,
  fetchStores,
  readVisitorLocation,
} from './store-grid'
import { CategoryCarousel } from '@/components/home/category-carousel'
import { HomeHero } from '@/components/home/home-hero'
import { ForRestaurants } from '@/components/home/for-restaurants'
import { HowItWorks } from '@/components/home/how-it-works'
import { StoreRail } from '@/components/home/store-rail'
import { type StoreCardData } from '@/components/store/store-card'
import { StoreGridSkeleton } from '@/components/store/store-card-skeleton'
import { Skeleton } from '@/components/ui/skeleton'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface HomePageProps {
  searchParams: Promise<{ error?: string; categoria?: string }>
}

/** How many stores the rail shows before the full grid takes over. */
const NEARBY_SHORTLIST = 8

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

function ShortcutSection({
  id,
  title,
  icon,
  stores,
}: {
  id: string
  title: string
  icon: React.ReactNode
  stores: StoreCardData[]
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="mb-10">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h2 id={`${id}-title`} className="text-h3 font-display font-semibold">
          {title}
        </h2>
      </div>
      <StoreRail stores={stores} label={title} />
    </section>
  )
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
  const nearby = stores.slice(0, NEARBY_SHORTLIST)

  return (
    <>
      <div className="mb-8">
        <CategoryCarousel categories={categories} />
      </div>

      {!category && reorder.length > 0 ? (
        <ShortcutSection
          id="reorder"
          title="Vuelve a pedir"
          icon={
            <RotateCcwIcon aria-hidden="true" className="text-primary size-4" />
          }
          stores={reorder}
        />
      ) : null}

      {!category && favorites.length > 0 ? (
        <ShortcutSection
          id="favorites"
          title="Tus favoritos"
          icon={
            <HeartIcon aria-hidden="true" className="text-primary size-4" />
          }
          stores={favorites}
        />
      ) : null}

      {/*
        The shortlist, as a rail. On a phone a single column of tall cards
        makes people scroll blind: they pass three restaurants before
        learning there was a fourth. The rail shows the next card's edge,
        which is the whole invitation; from `lg` there is room for a grid and
        the same markup lays itself out.
      */}
      {/*
        Only when it is genuinely a shortlist. With fewer stores than the cap,
        the rail would repeat the entire grid below it — the same seven cards
        twice, one section apart, which reads as padding rather than guidance.
      */}
      {!category && stores.length > NEARBY_SHORTLIST ? (
        <section aria-labelledby="cerca-title" className="mb-10">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-primary-on-tint text-sm font-medium">
                {location
                  ? location.label || 'Tu ubicación'
                  : 'Mejor valorados'}
              </p>
              <h2
                id="cerca-title"
                className="text-h2 font-display font-semibold"
              >
                {location ? 'Cerca de ti' : 'Los favoritos de la zona'}
              </h2>
            </div>
            <p className="text-muted-foreground max-w-sm text-sm">
              {location
                ? 'Ordenados por distancia, con tiempo estimado de llegada.'
                : 'Elige tu ubicación para ver distancias y tiempos de entrega.'}
            </p>
          </div>
          <StoreRail stores={nearby} label="Cerca de ti" priority />
        </section>
      ) : null}

      <div className="mb-5">
        <h2
          id="restaurantes-title"
          className="text-h2 font-display font-semibold"
        >
          {category ? category : 'Todos los restaurantes'}
        </h2>
      </div>
      <StoreGrid stores={stores} category={category} />
    </>
  )
}

function SectionsSkeleton() {
  return (
    <>
      <div aria-hidden="true" className="mb-8 flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="rounded-pill h-12 w-32 shrink-0" />
        ))}
      </div>
      <StoreGridSkeleton />
    </>
  )
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { error, categoria } = await searchParams
  const category = categoria?.trim() || null
  // A cookie read, so the hero — and its search box — paint immediately while
  // the store query streams in below.
  const location = await readVisitorLocation()

  return (
    <>
      <ForbiddenToast error={error} />

      <HomeHero location={location} />

      <section
        id="restaurantes"
        className="container-page scroll-mt-24 py-10 lg:py-14"
        aria-labelledby="restaurantes-title"
      >
        <Suspense fallback={<SectionsSkeleton />}>
          <StoreSections category={category} />
        </Suspense>
      </section>

      <HowItWorks />

      <ForRestaurants />

      <SiteFooter />
    </>
  )
}
