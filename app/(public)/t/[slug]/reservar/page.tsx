import { ArrowLeftIcon, CalendarDaysIcon, MapPinIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ReservationFlow } from './reservation-flow'
import { SiteFooter } from '@/components/layout/site-footer'
import { SchemeToggle } from '@/components/store/scheme-toggle'
import { StoreImage } from '@/components/store/store-image'
import { StoreThemeScope } from '@/components/store/store-theme-scope'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth'
import {
  fetchReservationSettings,
  isReservable,
  toReservationConfig,
} from '@/lib/reservations/server'
import { loadFromRows } from '@/lib/reservations/slots'
import { HOLDING_STATUSES } from '@/lib/reservations/vocabulary'
import { fetchStore } from '@/lib/store/data'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStoreTheme } from '@/lib/theme/resolve'
import type { Store, StoreTheme } from '@/types/app'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ fecha?: string; hora?: string; personas?: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  const store = await fetchStore(slug)
  if (!store) return { title: 'Reservar mesa' }
  return {
    title: `Reservar mesa en ${store.name}`,
    description: `Elige día, hora y número de personas y reserva tu mesa en ${store.name}. ${store.name} confirma tu reserva y te avisamos al instante.`,
  }
}

/**
 * The restaurant's own band at the top of the booking page: its logo, its
 * name in its display face, its gradient and pattern, so booking feels like
 * the restaurant's page and not a form of ours.
 */
function ReserveHeader({ store, theme }: { store: Store; theme: StoreTheme }) {
  return (
    <header className="relative isolate overflow-hidden border-b border-[rgb(var(--store-text-rgb)/0.08)] bg-[var(--store-surface)]">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[image:var(--store-gradient)] opacity-70"
      />
      <div
        aria-hidden="true"
        className="store-pattern absolute inset-0 -z-10"
      />
      <div className="container-page py-6 sm:py-10">
        <div className="mx-auto max-w-2xl space-y-5">
          <div className="flex items-center justify-between gap-3">
            <Link
              href={`/t/${store.slug}`}
              className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-1 text-sm"
            >
              <ArrowLeftIcon aria-hidden="true" className="size-4" />
              Volver a {store.name}
            </Link>
            {theme.mode === 'auto' ? (
              <SchemeToggle storeSlug={store.slug} />
            ) : null}
          </div>
          <div className="flex items-center gap-4">
            {theme.hero.showLogo ? (
              <div className="shadow-2 relative size-16 shrink-0 overflow-hidden rounded-[var(--store-radius)] bg-[var(--store-surface)] ring-2 ring-[rgb(var(--store-background-rgb)/0.9)] sm:size-20">
                <StoreImage
                  src={theme.logoUrl ?? store.logo_url}
                  alt=""
                  seed={`logo-${store.slug}`}
                  color={theme.primary}
                  label={store.name}
                  sizes="80px"
                  initialScale={1.15}
                />
              </div>
            ) : null}
            <div className="min-w-0 space-y-1.5">
              {/* A solid surface under it: on a bold brand gradient a tinted
                  chip would vanish. */}
              <p className="rounded-pill text-primary-on-tint inline-flex items-center gap-1.5 bg-[rgb(var(--store-surface-rgb)/0.92)] px-2.5 py-0.5 text-xs font-semibold tracking-wide uppercase ring-1 ring-[rgb(var(--store-text-rgb)/0.08)]">
                <CalendarDaysIcon aria-hidden="true" className="size-3.5" />
                Reservar mesa
              </p>
              <h1 className="store-heading text-h2 text-balance">
                {store.name}
              </h1>
              {store.address ? (
                <p className="text-muted-foreground flex items-center gap-1 text-sm">
                  <MapPinIcon aria-hidden="true" className="size-4 shrink-0" />
                  {store.address}
                </p>
              ) : null}
            </div>
          </div>
          <p className="text-muted-foreground text-sm text-pretty">
            Elige cuándo vienes. El restaurante confirma tu reserva y te
            avisamos al instante. Reservar no tiene costo.
          </p>
        </div>
      </div>
    </header>
  )
}

/**
 * Booking a table. Its own page rather than a drawer: it can be shared (a
 * restaurant's Instagram bio), the back button works, and the choice
 * survives signing in through the query string. It wears the restaurant's
 * theme, like its storefront.
 */
export default async function ReservePage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const query = await searchParams
  const store = await fetchStore(slug)
  if (!store) notFound()
  const theme = resolveStoreTheme(store)

  const settings = await fetchReservationSettings(store.id)
  const reservable = settings !== null && isReservable(store, settings)

  if (!reservable || !settings) {
    return (
      <StoreThemeScope theme={theme}>
        <div className="container-page py-section">
          <div className="rounded-card bg-card shadow-1 p-card mx-auto max-w-lg space-y-4 text-center">
            <h1 className="font-display text-2xl font-semibold">
              {store.name} no está recibiendo reservas en línea
            </h1>
            <p className="text-muted-foreground">
              Puedes pedir a domicilio o para recoger, o escribirle al
              restaurante para apartar tu mesa.
            </p>
            <Button asChild className="rounded-pill">
              <Link href={`/t/${store.slug}`}>Ver la tienda</Link>
            </Button>
          </div>
        </div>
        <SiteFooter tone="store" />
      </StoreThemeScope>
    )
  }

  const config = toReservationConfig(settings)
  const now = new Date()
  const horizon = new Date(
    now.getTime() + (config.maxDaysAhead + 2) * 24 * 60 * 60_000,
  )
  // Only aggregates leave the server: start times and party sizes, never
  // who booked.
  const [{ data: holding }, current] = await Promise.all([
    createAdminClient()
      .from('reservations')
      .select('starts_at, party_size')
      .eq('store_id', store.id)
      .in('status', [...HOLDING_STATUSES])
      .gte('starts_at', now.toISOString())
      .lt('starts_at', horizon.toISOString())
      .limit(5000),
    getCurrentUser(),
  ])

  const party = Number(query.personas)

  return (
    <StoreThemeScope theme={theme}>
      <ReserveHeader store={store} theme={theme} />
      <div className="container-page py-8 sm:py-10">
        <div className="mx-auto max-w-2xl">
          <ReservationFlow
            store={{
              id: store.id,
              slug: store.slug,
              name: store.name,
              address: store.address,
            }}
            schedule={store.schedule}
            config={config}
            load={loadFromRows(holding ?? [])}
            policy={settings.policy_text}
            nowIso={now.toISOString()}
            userId={current?.user.id ?? null}
            defaults={{
              name: current?.profile?.full_name ?? '',
              phone: current?.profile?.phone ?? '',
            }}
            initial={{
              date: query.fecha ?? null,
              time: query.hora ?? null,
              party: Number.isFinite(party) && party > 0 ? party : null,
            }}
          />
        </div>
      </div>
      <SiteFooter tone="store" />
    </StoreThemeScope>
  )
}
