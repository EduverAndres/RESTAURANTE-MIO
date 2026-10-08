import { QuoteIcon, StoreIcon } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { FadeIn } from '@/components/motion/fade-in'
import { StarRating } from '@/components/store/star-rating'
import { initialsOf } from '@/lib/format'
import {
  isTestimonial,
  TESTIMONIAL_MIN_RATING,
  visibleStats,
  type ProofStat,
} from '@/lib/marketplace/social-proof'
import { formatAverage, opinionCount } from '@/lib/store/reviews-summary'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const numberFormatter = new Intl.NumberFormat('es-CO')

interface Testimonial {
  id: string
  rating: number
  comment: string
  store: { name: string; slug: string }
}

interface Affiliate {
  id: string
  name: string
  slug: string
  logo_url: string | null
}

/**
 * Orders are private to their customer and store, so the public client
 * cannot count them. The count alone (`head: true`, no rows) goes through
 * the service-role client; if it is not configured the stat is just absent.
 */
async function countDeliveredOrders(): Promise<number | null> {
  try {
    const { count, error } = await createAdminClient()
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'delivered')
    return error ? null : (count ?? 0)
  } catch {
    return null
  }
}

async function loadProof() {
  const supabase = await createClient()
  const [storesResult, reviewsResult, delivered] = await Promise.all([
    // Every active store, small columns only: the totals come from the
    // per-store aggregates the review trigger already maintains, so the
    // average is exact without reading a single review row.
    supabase
      .from('stores')
      .select('id, name, slug, logo_url, rating_avg, rating_count')
      .eq('status', 'active')
      .order('rating_count', { ascending: false }),
    supabase
      .from('reviews')
      .select('id, rating, comment, store:stores!inner(name, slug)')
      .gte('rating', TESTIMONIAL_MIN_RATING)
      .not('comment', 'is', null)
      .order('created_at', { ascending: false })
      .limit(24),
    countDeliveredOrders(),
  ])

  const stores = storesResult.data ?? []
  const reviewCount = stores.reduce(
    (total, store) => total + (store.rating_count ?? 0),
    0,
  )
  const ratingSum = stores.reduce(
    (total, store) =>
      total + Number(store.rating_avg ?? 0) * (store.rating_count ?? 0),
    0,
  )

  const stats = visibleStats({
    stores: stores.length,
    reviews: reviewCount,
    ratingAverage:
      reviewCount > 0 ? Math.round((ratingSum / reviewCount) * 10) / 10 : null,
    deliveredOrders: delivered,
  })

  const testimonials: Testimonial[] = (reviewsResult.data ?? [])
    .filter(isTestimonial)
    .slice(0, 6)
    .map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment!.trim(),
      store: review.store,
    }))

  const affiliates: Affiliate[] = stores.slice(0, 12).map((store) => ({
    id: store.id,
    name: store.name,
    slug: store.slug,
    logo_url: store.logo_url,
  }))

  return { stats, testimonials, affiliates }
}

/**
 * Who else is here and what they thought. Everything on it is read from the
 * database at request time, and every block hides itself until there is
 * enough real material to fill it (see `PROOF_THRESHOLDS`).
 */
export async function SocialProof() {
  const { stats, testimonials, affiliates } = await loadProof()
  const showTestimonials = testimonials.length >= 2
  const showAffiliates = affiliates.length >= 3

  if (stats.length === 0 && !showTestimonials && !showAffiliates) return null

  return (
    <section
      aria-labelledby="confianza-title"
      className="border-border/60 border-t"
    >
      <div className="container-page py-section space-y-12">
        <FadeIn inView className="max-w-2xl space-y-3">
          <p className="text-primary-on-tint text-xs font-semibold tracking-wide uppercase">
            Comunidad
          </p>
          <h2
            id="confianza-title"
            className="text-h1 font-display font-semibold"
          >
            Barranquilla ya está pidiendo aquí
          </h2>
        </FadeIn>

        {stats.length > 0 ? (
          <FadeIn inView>
            <dl className="gap-card grid sm:grid-cols-3">
              {stats.map((stat) => (
                <Stat key={stat.key} stat={stat} />
              ))}
            </dl>
          </FadeIn>
        ) : null}

        {showTestimonials ? (
          <ul
            aria-label="Opiniones de clientes"
            className="rail -mx-gutter px-gutter gap-card pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-3"
          >
            {testimonials.map((testimonial, index) => (
              <li
                key={testimonial.id}
                className="w-[82vw] max-w-sm md:w-auto md:max-w-none"
              >
                <FadeIn inView delay={(index % 3) * 0.08} className="h-full">
                  <figure className="rounded-card bg-card shadow-1 ring-foreground/5 p-card flex h-full flex-col gap-4 ring-1">
                    <div className="flex items-center justify-between">
                      <StarRating value={testimonial.rating} />
                      <QuoteIcon
                        aria-hidden="true"
                        className="text-primary/25 size-6"
                      />
                    </div>
                    <blockquote className="text-foreground flex-1 text-pretty">
                      “{testimonial.comment}”
                    </blockquote>
                    <figcaption className="text-muted-foreground text-sm">
                      Cliente de{' '}
                      <Link
                        href={`/t/${testimonial.store.slug}`}
                        className="text-foreground font-medium underline-offset-4 hover:underline"
                      >
                        {testimonial.store.name}
                      </Link>
                    </figcaption>
                  </figure>
                </FadeIn>
              </li>
            ))}
          </ul>
        ) : null}

        {showAffiliates ? (
          <FadeIn inView className="space-y-4">
            <h3 className="text-muted-foreground text-sm font-medium">
              Negocios que ya venden con nosotros
            </h3>
            <ul className="flex flex-wrap gap-2">
              {affiliates.map((store) => (
                <li key={store.id}>
                  <Link
                    href={`/t/${store.slug}`}
                    className="rounded-pill bg-card shadow-1 ring-foreground/5 hover:shadow-2 inline-flex items-center gap-2 py-1.5 pr-4 pl-1.5 text-sm font-medium ring-1 transition-shadow"
                  >
                    <span className="bg-primary/10 text-primary-on-tint relative grid size-7 place-items-center overflow-hidden rounded-full text-[11px] font-semibold">
                      {store.logo_url ? (
                        <Image
                          src={store.logo_url}
                          alt=""
                          fill
                          sizes="28px"
                          className="object-cover"
                        />
                      ) : (
                        <span aria-hidden="true">{initialsOf(store.name)}</span>
                      )}
                    </span>
                    {store.name}
                  </Link>
                </li>
              ))}
            </ul>
          </FadeIn>
        ) : null}
      </div>
    </section>
  )
}

function Stat({ stat }: { stat: ProofStat }) {
  const content =
    stat.key === 'stores'
      ? {
          value: numberFormatter.format(stat.value),
          label: 'negocios locales vendiendo',
          extra: (
            <StoreIcon aria-hidden="true" className="text-primary size-5" />
          ),
        }
      : stat.key === 'rating'
        ? {
            value: formatAverage(stat.value),
            label: `calificación promedio · ${opinionCount(stat.reviews)}`,
            extra: <StarRating value={stat.value} />,
          }
        : {
            value: numberFormatter.format(stat.value),
            label: 'pedidos entregados',
            extra: null,
          }

  return (
    <div className="rounded-card bg-card shadow-1 ring-foreground/5 p-card flex flex-col-reverse gap-1 ring-1">
      <dt className="text-muted-foreground text-sm">{content.label}</dt>
      <dd className="flex items-center justify-between gap-3">
        <span className="font-display text-h1 font-semibold tabular-nums">
          {content.value}
        </span>
        {content.extra}
      </dd>
    </div>
  )
}
