'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { ClockIcon, NavigationIcon, StarIcon } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { FavoriteButton } from '@/components/store/favorite-button'
import { PriceChip } from '@/components/ui/price-chip'
import { formatDistance } from '@/lib/geo'
import type { Store } from '@/types/app'

export type StoreCardData = Pick<
  Store,
  | 'id'
  | 'slug'
  | 'name'
  | 'category'
  | 'cover_url'
  | 'rating_avg'
  | 'rating_count'
  | 'prep_time_min'
  | 'delivery_fee'
  | 'is_open'
> & {
  /** Present when the visitor shared a location. */
  distance_km?: number | null
  eta_min?: number | null
  is_favorite?: boolean
}

interface StoreCardProps {
  store: StoreCardData
  priority?: boolean
  showFavorite?: boolean
}

export function StoreCard({
  store,
  priority = false,
  showFavorite = true,
}: StoreCardProps) {
  const reduceMotion = useReducedMotion()
  const eta = store.eta_min ?? store.prep_time_min ?? 20

  return (
    <motion.article
      whileHover={reduceMotion ? undefined : { y: -6 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className="group rounded-card bg-card shadow-soft ring-foreground/5 hover:shadow-lift relative overflow-hidden ring-1 transition-shadow"
    >
      <Link
        href={`/t/${store.slug}`}
        className="block focus-visible:outline-none"
        aria-label={`Ver ${store.name}`}
      >
        <div className="bg-muted relative aspect-[4/3] w-full overflow-hidden">
          {store.cover_url ? (
            <Image
              src={store.cover_url}
              alt=""
              fill
              priority={priority}
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            />
          ) : null}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent"
          />
          <PriceChip
            amount={Number(store.delivery_fee ?? 0)}
            size="sm"
            className="absolute top-3 left-3"
          />
          {!store.is_open ? (
            <span className="rounded-pill absolute top-3 right-14 bg-black/70 px-2.5 py-1 text-xs font-medium text-white">
              Cerrado
            </span>
          ) : null}
          <div className="absolute inset-x-4 bottom-3 text-white">
            <h3 className="font-display text-2xl leading-tight font-semibold text-white drop-shadow-sm">
              {store.name}
            </h3>
            {store.category ? (
              <p className="text-sm text-white/85">{store.category}</p>
            ) : null}
          </div>
        </div>

        <div className="text-muted-foreground flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <StarIcon
              aria-hidden="true"
              className="fill-accent text-accent size-4"
            />
            <span className="text-foreground font-medium">
              {Number(store.rating_avg ?? 0).toFixed(1)}
            </span>
            <span className="sr-only">de 5,</span>
            <span>({store.rating_count ?? 0})</span>
          </span>
          <span className="inline-flex items-center gap-3">
            {typeof store.distance_km === 'number' ? (
              <span className="inline-flex items-center gap-1">
                <NavigationIcon aria-hidden="true" className="size-3.5" />
                {formatDistance(store.distance_km)}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon aria-hidden="true" className="size-4" />
              {eta} min
            </span>
          </span>
        </div>
      </Link>

      {showFavorite ? (
        <FavoriteButton
          storeId={store.id}
          storeName={store.name}
          initial={Boolean(store.is_favorite)}
          className="absolute top-3 right-3"
        />
      ) : null}
    </motion.article>
  )
}
