import { ArrowLeftIcon, MapPinIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ReservationFlow } from './reservation-flow'
import { SiteFooter } from '@/components/layout/site-footer'
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
 * Booking a table. Its own page rather than a drawer: it can be shared (a
 * restaurant's Instagram bio), the back button works, and the choice
 * survives signing in through the query string.
 */
export default async function ReservePage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const query = await searchParams
  const store = await fetchStore(slug)
  if (!store) notFound()

  const settings = await fetchReservationSettings(store.id)
  const reservable = settings !== null && isReservable(store, settings)

  if (!reservable || !settings) {
    return (
      <>
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
        <SiteFooter />
      </>
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
    <>
      <div className="container-page py-8 sm:py-12">
        <div className="mx-auto max-w-2xl space-y-6">
          <Link
            href={`/t/${store.slug}`}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeftIcon aria-hidden="true" className="size-4" />
            Volver a {store.name}
          </Link>
          <header className="space-y-2">
            <p className="text-primary-on-tint text-xs font-semibold tracking-wide uppercase">
              Reservar mesa
            </p>
            <h1 className="text-h1 font-display font-semibold">{store.name}</h1>
            {store.address ? (
              <p className="text-muted-foreground flex items-center gap-1 text-sm">
                <MapPinIcon aria-hidden="true" className="size-4" />
                {store.address}
              </p>
            ) : null}
            <p className="text-muted-foreground text-sm text-pretty">
              Elige cuándo vienes. El restaurante confirma tu reserva y te
              avisamos al instante. Reservar no tiene costo.
            </p>
          </header>

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
            signedIn={current !== null}
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
      <SiteFooter />
    </>
  )
}
