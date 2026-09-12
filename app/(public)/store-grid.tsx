import { cookies } from 'next/headers'
import Link from 'next/link'
import { StoreCard, type StoreCardData } from '@/components/store/store-card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { estimateEtaMinutes } from '@/lib/geo'
import {
  LOCATION_COOKIE,
  parseLocation,
  type VisitorLocation,
} from '@/lib/location'
import { createClient } from '@/lib/supabase/server'

export const STORE_CARD_COLUMNS =
  'id, slug, name, category, logo_url, cover_url, rating_avg, rating_count, prep_time_min, delivery_fee, is_open'

const NEARBY_RADIUS_KM = 15

export async function readVisitorLocation(): Promise<VisitorLocation | null> {
  const store = await cookies()
  return parseLocation(store.get(LOCATION_COOKIE)?.value)
}

async function readFavoriteIds(): Promise<Set<string>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Set()
  const { data } = await supabase
    .from('favorites')
    .select('store_id')
    .eq('user_id', user.id)
  return new Set((data ?? []).map((row) => row.store_id))
}

/**
 * Active stores ranked by distance when a location is known (via the
 * stores_nearby SQL function), otherwise by rating.
 */
export async function fetchStores(
  location: VisitorLocation | null,
): Promise<StoreCardData[]> {
  const supabase = await createClient()
  const favorites = await readFavoriteIds()

  if (location) {
    const { data, error } = await supabase.rpc('stores_nearby', {
      p_lat: location.lat,
      p_lng: location.lng,
      p_radius_km: NEARBY_RADIUS_KM,
    })
    if (error) console.error('stores_nearby failed', error)
    if (data && data.length > 0) {
      return data.map((store) => ({
        id: store.id,
        slug: store.slug,
        name: store.name,
        category: store.category,
        logo_url: store.logo_url,
        cover_url: store.cover_url,
        rating_avg: store.rating_avg,
        rating_count: store.rating_count,
        prep_time_min: store.prep_time_min,
        delivery_fee: store.delivery_fee,
        is_open: store.is_open,
        distance_km: Number(store.distance_km),
        eta_min: estimateEtaMinutes({
          distanceKm: Number(store.distance_km),
          prepTimeMin: store.prep_time_min ?? 20,
        }),
        is_favorite: favorites.has(store.id),
      }))
    }
  }

  const { data, error } = await supabase
    .from('stores')
    .select(STORE_CARD_COLUMNS)
    .eq('status', 'active')
    .order('rating_avg', { ascending: false })
    .order('rating_count', { ascending: false })
    .limit(24)
  if (error) {
    console.error('Failed to load stores', error)
    return []
  }
  return (data ?? []).map((store) => ({
    ...store,
    is_favorite: favorites.has(store.id),
  }))
}

export function categoriesOf(
  stores: StoreCardData[],
): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  stores.forEach((store) => {
    if (store.category)
      counts.set(store.category, (counts.get(store.category) ?? 0) + 1)
  })
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

interface StoreGridProps {
  stores: StoreCardData[]
  category: string | null
}

export function StoreGrid({ stores, category }: StoreGridProps) {
  const visible = category
    ? stores.filter(
        (store) => store.category?.toLowerCase() === category.toLowerCase(),
      )
    : stores

  if (visible.length === 0) {
    return (
      <EmptyState
        title={
          category
            ? `Nada de ${category} por aquí todavía`
            : 'Todavía no hay restaurantes cerca'
        }
        description={
          category
            ? 'Prueba con otra categoría o quita el filtro para ver todo lo disponible.'
            : 'Amplía tu zona o vuelve pronto: estamos sumando restaurantes.'
        }
        action={
          category ? (
            <Button asChild variant="outline" className="rounded-pill">
              <Link href="/#restaurantes">Ver todos</Link>
            </Button>
          ) : undefined
        }
      />
    )
  }

  return (
    <div className="gap-card grid sm:grid-cols-2 lg:grid-cols-3">
      {visible.map((store) => (
        // Nothing here is the LCP any more: the hero's brand line and search
        // box own the first screen, and this grid sits below the rail.
        <StoreCard key={store.id} store={store} />
      ))}
    </div>
  )
}
