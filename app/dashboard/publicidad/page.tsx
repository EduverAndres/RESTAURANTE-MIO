import { MegaphoneIcon, MousePointerClickIcon } from 'lucide-react'
import type { Metadata } from 'next'
import { AdRequestForm } from '@/components/dashboard/ads/ad-request-form'
import { CancelAdRequestButton } from '@/components/dashboard/ads/cancel-ad-request-button'
import { StatusBadge } from '@/components/orders/order-status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import {
  adChargedToDate,
  adDisplayStatus,
  isAdBilled,
  type AdPauseSpan,
} from '@/lib/ads/billing'
import type { SlotCampaign } from '@/lib/ads/capacity'
import {
  adDays,
  daysLabel,
  formatAdDay,
  formatAdRange,
  type AdPlacementSettings,
} from '@/lib/ads/pricing'
import {
  AD_HOLDING_STATUSES,
  AD_PAUSE_REASON_LABELS,
  AD_PLACEMENTS,
  AD_PLACEMENT_LABELS,
  AD_STATUS_LABELS,
  AD_STATUS_TONES,
  SPONSORED_LABEL,
  isAdPlacement,
  type AdPauseReason,
  type AdStatus,
} from '@/lib/ads/vocabulary'
import { requireActiveStoreRow } from '@/lib/dashboard/store-context'
import { formatCOP } from '@/lib/format'
import { bogotaDate } from '@/lib/plans'
import { addDays } from '@/lib/store/hours'
import { createAdminClient } from '@/lib/supabase/admin'
import { throwOnQueryError } from '@/lib/supabase/query-error'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Publicidad' }
export const dynamic = 'force-dynamic'

/** Days of clicks shown per campaign: the last week it ran. */
const CLICK_DAYS = 7

function clickSeries(
  stats: Map<string, number>,
  startsOn: string,
  endsOn: string,
  today: string,
): { day: string; clicks: number }[] {
  const last = endsOn < today ? endsOn : today
  if (last < startsOn) return []
  const first =
    addDays(last, -(CLICK_DAYS - 1)) > startsOn
      ? addDays(last, -(CLICK_DAYS - 1))
      : startsOn
  const series: { day: string; clicks: number }[] = []
  for (let day = first; day <= last; day = addDays(day, 1)) {
    series.push({ day, clicks: stats.get(day) ?? 0 })
  }
  return series
}

/**
 * Sponsored placements for the merchant: what they cost, a request with a
 * live quote, and each campaign with its status, what it has run so far and
 * its clicks per day.
 */
export default async function DashboardAdsPage() {
  const { store } = await requireActiveStoreRow('/dashboard/publicidad')
  const supabase = await createClient()
  const today = bogotaDate(new Date())

  const [
    { data: placementRows, error: placementsError },
    { data: campaigns, error: campaignsError },
  ] = await Promise.all([
    supabase.from('ad_placements').select('*'),
    supabase
      .from('ad_campaigns')
      .select('*')
      .eq('store_id', store.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])
  throwOnQueryError(placementsError, 'ad placements')
  throwOnQueryError(campaignsError, 'merchant ad campaigns')

  const ids = (campaigns ?? []).map((campaign) => campaign.id)
  const [
    { data: pauses, error: pausesError },
    { data: stats, error: statsError },
    // Every store's approved campaigns, without who they are: only what the
    // live "hay cupo" check needs. Read with the service role because a
    // merchant only sees their own campaigns.
    { data: holders, error: holdersError },
  ] = await Promise.all([
    ids.length > 0
      ? supabase
          .from('ad_campaign_pauses')
          .select('campaign_id, paused_at, resumed_at')
          .in('campaign_id', ids)
      : Promise.resolve({ data: [], error: null }),
    ids.length > 0
      ? supabase
          .from('ad_daily_stats')
          .select('campaign_id, day, clicks')
          .in('campaign_id', ids)
          .gte('day', addDays(today, -90))
      : Promise.resolve({ data: [], error: null }),
    createAdminClient()
      .from('ad_campaigns')
      .select('placement, status, starts_on, ends_on, category_snapshot')
      .in('status', [...AD_HOLDING_STATUSES])
      .gte('ends_on', today),
  ])
  throwOnQueryError(pausesError, 'merchant ad pauses')
  throwOnQueryError(statsError, 'merchant ad stats')
  throwOnQueryError(holdersError, 'ad occupancy')

  const placements: AdPlacementSettings[] = (placementRows ?? [])
    .filter((row) => isAdPlacement(row.placement))
    .map((row) => ({
      placement: row.placement as AdPlacementSettings['placement'],
      daily_price: Number(row.daily_price),
      max_slots: row.max_slots,
      min_days: row.min_days,
      max_days: row.max_days,
      active: row.active,
    }))
    .sort(
      (a, b) =>
        AD_PLACEMENTS.indexOf(a.placement) - AD_PLACEMENTS.indexOf(b.placement),
    )
  const occupancy: SlotCampaign[] = (holders ?? [])
    .filter((row) => isAdPlacement(row.placement))
    .map((row) => ({
      placement: row.placement as SlotCampaign['placement'],
      status: row.status as AdStatus,
      starts_on: row.starts_on,
      ends_on: row.ends_on,
      category_snapshot: row.category_snapshot,
    }))

  const pausesOf = new Map<string, AdPauseSpan[]>()
  for (const pause of pauses ?? []) {
    const list = pausesOf.get(pause.campaign_id) ?? []
    list.push(pause)
    pausesOf.set(pause.campaign_id, list)
  }
  const statsOf = new Map<string, Map<string, number>>()
  for (const row of stats ?? []) {
    const days = statsOf.get(row.campaign_id) ?? new Map<string, number>()
    days.set(row.day, row.clicks)
    statsOf.set(row.campaign_id, days)
  }

  const blockedReason =
    store.status === 'active'
      ? null
      : 'Tu tienda debe estar aprobada y activa para anunciarse.'

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Publicidad
        </h1>
        <p className="text-muted-foreground max-w-3xl text-sm text-pretty">
          Aparece primero donde los clientes eligen: en los destacados de la
          página principal, en tu categoría o en la búsqueda. Pagas por día,
          solo los días que tu anuncio está al aire, y se descuenta de tus
          liquidaciones. Tu anuncio siempre se muestra con la etiqueta «
          {SPONSORED_LABEL}».
        </p>
      </header>

      <section
        aria-labelledby="ads-request-title"
        className="rounded-card bg-card shadow-1 p-card space-y-4"
      >
        <div className="flex items-center gap-2">
          <MegaphoneIcon aria-hidden="true" className="text-primary size-5" />
          <h2
            id="ads-request-title"
            className="text-h3 font-display font-semibold"
          >
            Solicitar una campaña
          </h2>
        </div>
        <p className="text-muted-foreground text-sm text-pretty">
          El equipo de Cerquita revisa cada solicitud. No se cobra nada hasta
          que sale al aire; si la aprobamos después del primer día que pediste,
          empieza ese día y pagas menos.
        </p>
        <AdRequestForm
          placements={placements}
          occupancy={occupancy}
          own={(campaigns ?? [])
            .filter((campaign) => isAdPlacement(campaign.placement))
            .map((campaign) => ({
              placement: campaign.placement as SlotCampaign['placement'],
              status: campaign.status as AdStatus,
              starts_on: campaign.starts_on,
              ends_on: campaign.ends_on,
              category_snapshot: campaign.category_snapshot,
            }))}
          category={store.category?.trim() || null}
          today={today}
          blockedReason={blockedReason}
        />
      </section>

      <section aria-labelledby="ads-campaigns-title" className="space-y-4">
        <h2
          id="ads-campaigns-title"
          className="text-h3 font-display font-semibold"
        >
          Tus campañas
        </h2>
        {(campaigns ?? []).length === 0 ? (
          <EmptyState
            title="Todavía no tienes campañas"
            description="Cuando solicites una, aquí verás su estado, lo que lleva corrido y los clics que recibe cada día."
          />
        ) : (
          <ul className="gap-card grid">
            {(campaigns ?? []).map((campaign) => {
              const status = campaign.status as AdStatus
              const display = adDisplayStatus({ ...campaign, status }, today)
              const placement = isAdPlacement(campaign.placement)
                ? AD_PLACEMENT_LABELS[campaign.placement]
                : campaign.placement
              const days = adDays(campaign.starts_on, campaign.ends_on)
              const charged = isAdBilled(status)
                ? adChargedToDate(
                    {
                      status,
                      starts_on: campaign.starts_on,
                      ends_on: campaign.ends_on,
                      ended_at: campaign.ended_at,
                      daily_price: Number(campaign.daily_price),
                    },
                    pausesOf.get(campaign.id) ?? [],
                    today,
                  )
                : null
              const clicks = statsOf.get(campaign.id) ?? new Map()
              const totalClicks = [...clicks.values()].reduce(
                (sum: number, value: number) => sum + value,
                0,
              )
              const series = isAdBilled(status)
                ? clickSeries(
                    clicks,
                    campaign.starts_on,
                    campaign.ends_on,
                    today,
                  )
                : []
              return (
                <li
                  key={campaign.id}
                  className="rounded-card bg-card shadow-1 p-card space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-medium">{placement}</h3>
                      <p className="text-muted-foreground text-sm">
                        {formatAdRange(campaign.starts_on, campaign.ends_on)} ·{' '}
                        {daysLabel(days)} ·{' '}
                        {formatCOP(Number(campaign.daily_price))} por día
                        {campaign.placement === 'category_top' &&
                        campaign.category_snapshot
                          ? ` · ${campaign.category_snapshot}`
                          : ''}
                      </p>
                    </div>
                    <StatusBadge
                      label={AD_STATUS_LABELS[display]}
                      tone={AD_STATUS_TONES[display]}
                    />
                  </div>

                  <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-muted-foreground">Valor máximo</dt>
                      <dd className="font-medium tabular-nums">
                        {formatCOP(Number(campaign.total_price))}
                      </dd>
                    </div>
                    {charged !== null ? (
                      <div>
                        <dt className="text-muted-foreground">
                          Corrido hasta hoy
                        </dt>
                        <dd className="font-medium tabular-nums">
                          {formatCOP(charged)}
                        </dd>
                      </div>
                    ) : null}
                    {isAdBilled(status) ? (
                      <div>
                        <dt className="text-muted-foreground">Clics</dt>
                        <dd className="font-medium tabular-nums">
                          {totalClicks}
                        </dd>
                      </div>
                    ) : null}
                  </dl>

                  {status === 'paused' && campaign.pause_reason ? (
                    <p className="text-muted-foreground text-sm">
                      {AD_PAUSE_REASON_LABELS[
                        campaign.pause_reason as AdPauseReason
                      ] ?? 'Pausada'}
                      . Los días en pausa no se cobran.
                    </p>
                  ) : null}
                  {status === 'rejected' && campaign.rejection_reason ? (
                    <p className="text-sm">
                      <span className="font-medium">Motivo: </span>
                      {campaign.rejection_reason}
                    </p>
                  ) : null}

                  {series.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                        <MousePointerClickIcon
                          aria-hidden="true"
                          className="size-3.5"
                        />
                        Clics por día
                      </p>
                      <ol className="grid grid-cols-7 gap-1.5">
                        {series.map((point) => (
                          <li
                            key={point.day}
                            className="rounded-control bg-secondary/40 flex flex-col items-center px-1 py-1.5 text-center"
                          >
                            <span className="text-muted-foreground text-xs leading-tight">
                              {formatAdDay(point.day)}
                            </span>
                            <span className="font-medium tabular-nums">
                              {point.clicks}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}

                  {status === 'requested' ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-muted-foreground text-sm">
                        Esperando revisión del equipo de Cerquita.
                      </p>
                      <CancelAdRequestButton campaignId={campaign.id} />
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
