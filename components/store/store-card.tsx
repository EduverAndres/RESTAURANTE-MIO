'use client'

import { motion, useReducedMotion } from 'framer-motion'
import {
  BadgeCheckIcon,
  BikeIcon,
  ClockIcon,
  FlameIcon,
  NavigationIcon,
  SparklesIcon,
  StarIcon,
  ZapIcon,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { FavoriteButton } from '@/components/store/favorite-button'
import { MediaChip } from '@/components/ui/media-chip'
import { formatCOP, initialsOf } from '@/lib/format'
import { formatDistance } from '@/lib/geo'
import {
  etaOf,
  hasFreeDelivery,
  primaryHighlight,
} from '@/lib/marketplace/highlights'
import { cn } from '@/lib/utils'
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
  /** Optional: callers that do not select it simply get the initials mark. */
  logo_url?: string | null
  /** Optional: shown as "Mín." in the footer when the caller selected it. */
  min_order?: number | null
  /** Present when the visitor shared a location. */
  distance_km?: number | null
  eta_min?: number | null
  is_favorite?: boolean
}

interface StoreCardProps {
  store: StoreCardData
  priority?: boolean
  showFavorite?: boolean
  /**
   * `rail` drops the card's own width so a horizontal carousel can size it,
   * and uses a narrower `sizes` because the card is smaller there.
   */
  variant?: 'grid' | 'rail'
  className?: string
}

const SIZES = {
  grid: '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw',
  rail: '(min-width: 1024px) 33vw, 78vw',
} as const

const HIGHLIGHTS = {
  popular: { icon: FlameIcon, label: 'Popular' },
  fast: { icon: ZapIcon, label: 'Entrega rápida' },
  new: { icon: SparklesIcon, label: 'Nuevo' },
} as const

export function StoreCard({
  store,
  priority = false,
  showFavorite = true,
  variant = 'grid',
  className,
}: StoreCardProps) {
  const reduceMotion = useReducedMotion()
  const eta = etaOf(store)
  const fee = Number(store.delivery_fee ?? 0)
  const freeDelivery = hasFreeDelivery(store)
  const rating = Number(store.rating_avg ?? 0)
  const ratingCount = store.rating_count ?? 0
  const minOrder = Number(store.min_order ?? 0)
  const highlight = primaryHighlight(store)
  const Highlight = highlight ? HIGHLIGHTS[highlight] : null

  return (
    <motion.article
      whileHover={reduceMotion ? undefined : { y: -4 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className={cn(
        'group rounded-card bg-card shadow-1 hover:shadow-3 ring-foreground/5 relative isolate overflow-hidden ring-1 transition-shadow duration-300',
        className,
      )}
    >
      <Link
        href={`/t/${store.slug}`}
        className="block focus-visible:outline-none"
        aria-label={`Ver ${store.name}`}
      >
        {/* Edge to edge: the photograph is the card, not an illustration
            inside it. Everything else floats on top of it. */}
        <div className="bg-muted relative aspect-[4/3] w-full overflow-hidden">
          {store.cover_url ? (
            <Image
              src={store.cover_url}
              alt=""
              fill
              priority={priority}
              sizes={SIZES[variant]}
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            />
          ) : (
            <span
              aria-hidden="true"
              className="from-secondary via-muted to-card text-foreground/10 font-display absolute inset-0 flex items-center justify-center bg-gradient-to-br text-7xl font-semibold"
            >
              {initialsOf(store.name)}
            </span>
          )}

          {/* Two stops, not three: the name sits in the deepest part and the
              chips at the top stay over clean photo. A closed shop gets one
              extra wash on the photo — never over the name, because "which
              restaurant is this?" is still the first question. */}
          <div
            aria-hidden="true"
            className={cn(
              'absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent',
              !store.is_open && 'from-black/85 via-black/55 to-black/45',
            )}
          />

          <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
            {store.is_open ? (
              <>
                <MediaChip
                  icon={<ClockIcon aria-hidden="true" className="size-3.5" />}
                >
                  {eta} min
                </MediaChip>
                <MediaChip
                  icon={<BikeIcon aria-hidden="true" className="size-3.5" />}
                  className={
                    freeDelivery
                      ? 'bg-success text-success-foreground'
                      : undefined
                  }
                >
                  {freeDelivery ? 'Envío gratis' : formatCOP(fee)}
                </MediaChip>
              </>
            ) : (
              <MediaChip>Cerrado ahora</MediaChip>
            )}
          </div>

          <div className="absolute inset-x-4 bottom-3 flex items-end gap-3">
            {/* The merchant's mark, overlaid on their own photo. A logo is
                how a regular recognises the place before reading the name. */}
            <span className="bg-card shadow-2 relative size-12 shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/25">
              {store.logo_url ? (
                <Image
                  src={store.logo_url}
                  alt=""
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="bg-primary/12 text-primary-on-tint font-display absolute inset-0 grid place-items-center text-base font-semibold"
                >
                  {initialsOf(store.name)}
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <h3 className="font-display flex items-center gap-1.5 text-xl leading-tight font-semibold text-white drop-shadow-sm sm:text-2xl">
                <span className="min-w-0 truncate">{store.name}</span>
                {/* Every listed store passed the admin review that turns
                    `pending` into `active`, so the mark is always earned. */}
                <BadgeCheckIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-white/90 sm:size-5"
                />
                <span className="sr-only">, comercio verificado</span>
              </h3>
              {store.category ? (
                <p className="truncate text-sm text-white/85">
                  {store.category}
                </p>
              ) : null}
            </span>
          </div>
        </div>

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
          {ratingCount > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <StarIcon
                aria-hidden="true"
                className="fill-accent text-accent size-4"
              />
              <span className="text-foreground font-medium">
                {rating.toFixed(1)}
              </span>
              <span className="sr-only">de 5,</span>
              <span>({ratingCount})</span>
            </span>
          ) : null}
          {Highlight ? (
            <span className="rounded-pill bg-primary/10 text-primary-on-tint inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium">
              <Highlight.icon aria-hidden="true" className="size-3.5" />
              {Highlight.label}
            </span>
          ) : null}
          <span className="ml-auto inline-flex items-center gap-3">
            {minOrder > 0 ? (
              <span className="tabular-nums">
                <span className="sr-only">Pedido mínimo </span>
                <span aria-hidden="true">Mín. </span>
                {formatCOP(minOrder)}
              </span>
            ) : null}
            {typeof store.distance_km === 'number' ? (
              <span className="inline-flex items-center gap-1.5">
                <NavigationIcon aria-hidden="true" className="size-3.5" />
                {formatDistance(store.distance_km)}
              </span>
            ) : null}
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
