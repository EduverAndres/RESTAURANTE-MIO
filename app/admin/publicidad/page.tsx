import type { Metadata } from 'next'
import { AdPlacementForm } from '@/components/admin/ad-placement-form'
import { AdReviewActions } from '@/components/admin/ad-review-actions'
import { StatusBadge } from '@/components/orders/order-status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { requireRole } from '@/lib/auth'
import {
  adChargedToDate,
  adDisplayStatus,
  adFeeForPeriod,
  isAdBilled,
  type AdPauseSpan,
  type BillableCampaign,
} from '@/lib/ads/billing'
import {
  adDays,
  daysLabel,
  formatAdRange,
  type AdPlacementSettings,
} from '@/lib/ads/pricing'
import {
  AD_PAUSE_REASON_LABELS,
  AD_PLACEMENTS,
  AD_PLACEMENT_LABELS,
  AD_STATUS_LABELS,
  AD_STATUS_TONES,
  isAdPlacement,
  type AdPauseReason,
  type AdStatus,
} from '@/lib/ads/vocabulary'
import { formatCOP } from '@/lib/format'
import { formatDateCO } from '@/lib/format-date'
import { bogotaDate } from '@/lib/plans'
import { createAdminClient } from '@/lib/supabase/admin'
import { throwOnQueryError } from '@/lib/supabase/query-error'

export const metadata: Metadata = { title: 'Publicidad' }
export const dynamic = 'force-dynamic'

interface CampaignRow {
  id: string
  store: string
  placement: string
  category: string | null
  campaign: BillableCampaign
  pauseReason: string | null
  rejectionReason: string | null
  total: number
  createdAt: string
  clicks: number
  pauses: AdPauseSpan[]
}

function placementLabel(row: CampaignRow): string {
  const label = isAdPlacement(row.placement)
    ? AD_PLACEMENT_LABELS[row.placement]
    : row.placement
  return row.placement === 'category_top' && row.category
    ? `${label} · ${row.category}`
    : label
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="space-y-3">
      <div className="space-y-1">
        <h2 id={`${id}-title`} className="text-h3 font-display font-semibold">
          {title}
        </h2>
        {description ? (
          <p className="text-muted-foreground text-sm text-pretty">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

/**
 * Sponsored placements, for the Cerquita team: requests to decide, campaigns
 * on the air (pause, resume, end), the price list and the history. The fee
 * is charged in each store's payout; nothing here moves money.
 */
export default async function AdminAdsPage() {
  await requireRole(['admin'], '/admin/publicidad')
  const admin = createAdminClient()
  const today = bogotaDate(new Date())
  const monthStart = `${today.slice(0, 8)}01`

  const [
    { data: placementRows, error: placementsError },
    { data: campaigns, error: campaignsError },
  ] = await Promise.all([
    admin.from('ad_placements').select('*'),
    admin
      .from('ad_campaigns')
      .select('*, stores(name)')
      .order('created_at', { ascending: false })
      .limit(300),
  ])
  throwOnQueryError(placementsError, 'admin ad placements')
  throwOnQueryError(campaignsError, 'admin ad campaigns')

  const ids = (campaigns ?? []).map((campaign) => campaign.id)
  const [
    { data: pauses, error: pausesError },
    { data: stats, error: statsError },
  ] = await Promise.all([
    ids.length > 0
      ? admin
          .from('ad_campaign_pauses')
          .select('campaign_id, paused_at, resumed_at')
          .in('campaign_id', ids)
      : Promise.resolve({ data: [], error: null }),
    ids.length > 0
      ? admin
          .from('ad_daily_stats')
          .select('campaign_id, clicks')
          .in('campaign_id', ids)
      : Promise.resolve({ data: [], error: null }),
  ])
  throwOnQueryError(pausesError, 'admin ad pauses')
  throwOnQueryError(statsError, 'admin ad stats')

  const pausesOf = new Map<string, AdPauseSpan[]>()
  for (const pause of pauses ?? []) {
    pausesOf.set(pause.campaign_id, [
      ...(pausesOf.get(pause.campaign_id) ?? []),
      pause,
    ])
  }
  const clicksOf = new Map<string, number>()
  for (const row of stats ?? []) {
    clicksOf.set(
      row.campaign_id,
      (clicksOf.get(row.campaign_id) ?? 0) + row.clicks,
    )
  }

  const rows: CampaignRow[] = (campaigns ?? []).map((campaign) => ({
    id: campaign.id,
    store: campaign.stores?.name ?? 'Tienda',
    placement: campaign.placement,
    category: campaign.category_snapshot,
    campaign: {
      status: campaign.status as AdStatus,
      starts_on: campaign.starts_on,
      ends_on: campaign.ends_on,
      ended_at: campaign.ended_at,
      daily_price: Number(campaign.daily_price),
    },
    pauseReason: campaign.pause_reason,
    rejectionReason: campaign.rejection_reason,
    total: Number(campaign.total_price),
    createdAt: campaign.created_at,
    clicks: clicksOf.get(campaign.id) ?? 0,
    pauses: pausesOf.get(campaign.id) ?? [],
  }))

  const requested = rows
    .filter((row) => row.campaign.status === 'requested')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const live = rows
    .filter((row) => {
      const display = adDisplayStatus(row.campaign, today)
      return (
        display === 'active' || display === 'scheduled' || display === 'paused'
      )
    })
    .sort((a, b) => a.campaign.starts_on.localeCompare(b.campaign.starts_on))
  const liveIds = new Set([...requested, ...live].map((row) => row.id))
  const history = rows.filter((row) => !liveIds.has(row.id)).slice(0, 50)

  const onAir = live.filter(
    (row) => adDisplayStatus(row.campaign, today) === 'active',
  ).length
  const monthToDate = rows.reduce(
    (sum, row) =>
      sum +
      adFeeForPeriod(row.campaign, row.pauses, {
        periodStart: monthStart,
        periodEnd: today,
      }),
    0,
  )

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

  const status = (row: CampaignRow) => {
    const display = adDisplayStatus(row.campaign, today)
    return (
      <StatusBadge
        label={AD_STATUS_LABELS[display]}
        tone={AD_STATUS_TONES[display]}
      />
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="space-y-1">
        <h1 className="text-h1 font-display font-semibold">Publicidad</h1>
        <p className="text-muted-foreground text-sm text-pretty">
          Campañas patrocinadas de los comercios. Cada una se cobra por día en
          la liquidación de su tienda, solo los días que estuvo al aire; los
          días en pausa no se cobran. {requested.length} por aprobar · {onAir}{' '}
          al aire hoy · {formatCOP(monthToDate)} corridos este mes.
        </p>
      </header>

      <Section
        id="ads-requested"
        title="Por aprobar"
        description="Al aprobar se revisa el cupo de la ubicación. Si el primer día ya pasó, la campaña empieza hoy."
      >
        {requested.length === 0 ? (
          <EmptyState
            title="No hay solicitudes"
            description="Las campañas que pidan los comercios aparecerán aquí."
          />
        ) : (
          <div className="rounded-card bg-card shadow-1 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tienda</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Fechas</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Solicitada</TableHead>
                  <TableHead className="text-right">Revisión</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requested.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.store}</TableCell>
                    <TableCell>{placementLabel(row)}</TableCell>
                    <TableCell>
                      {formatAdRange(
                        row.campaign.starts_on,
                        row.campaign.ends_on,
                      )}
                      <span className="text-muted-foreground block text-xs">
                        {daysLabel(
                          adDays(row.campaign.starts_on, row.campaign.ends_on),
                        )}{' '}
                        × {formatCOP(row.campaign.daily_price)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCOP(row.total)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateCO(row.createdAt)}
                    </TableCell>
                    <TableCell>
                      <AdReviewActions
                        campaignId={row.id}
                        storeName={row.store}
                        status={row.campaign.status}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      <Section id="ads-live" title="Al aire y programadas">
        {live.length === 0 ? (
          <EmptyState
            title="Ninguna campaña al aire"
            description="Las campañas aprobadas aparecerán aquí hasta su último día."
          />
        ) : (
          <div className="rounded-card bg-card shadow-1 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tienda</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Fechas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Corrido</TableHead>
                  <TableHead className="text-right">Clics</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {live.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.store}</TableCell>
                    <TableCell>{placementLabel(row)}</TableCell>
                    <TableCell>
                      {formatAdRange(
                        row.campaign.starts_on,
                        row.campaign.ends_on,
                      )}
                    </TableCell>
                    <TableCell>
                      {status(row)}
                      {row.campaign.status === 'paused' && row.pauseReason ? (
                        <span className="text-muted-foreground mt-1 block text-xs">
                          {AD_PAUSE_REASON_LABELS[
                            row.pauseReason as AdPauseReason
                          ] ?? ''}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCOP(
                        adChargedToDate(row.campaign, row.pauses, today),
                      )}
                      <span className="text-muted-foreground block text-xs">
                        de {formatCOP(row.total)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.clicks}
                    </TableCell>
                    <TableCell>
                      <AdReviewActions
                        campaignId={row.id}
                        storeName={row.store}
                        status={row.campaign.status}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      <Section
        id="ads-prices"
        title="Precios y cupos"
        description="Un precio nuevo aplica a las solicitudes de ahora en adelante: cada campaña conserva el precio con el que se pidió. La página para restaurantes muestra estos precios."
      >
        <div className="gap-card grid md:grid-cols-3">
          {placements.map((placement) => (
            <AdPlacementForm key={placement.placement} initial={placement} />
          ))}
        </div>
      </Section>

      <Section id="ads-history" title="Historial">
        {history.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Todavía no hay campañas terminadas.
          </p>
        ) : (
          <div className="rounded-card bg-card shadow-1 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tienda</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Fechas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Cobrado</TableHead>
                  <TableHead className="text-right">Clics</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.store}</TableCell>
                    <TableCell>{placementLabel(row)}</TableCell>
                    <TableCell>
                      {formatAdRange(
                        row.campaign.starts_on,
                        row.campaign.ends_on,
                      )}
                    </TableCell>
                    <TableCell>
                      {status(row)}
                      {row.rejectionReason ? (
                        <span className="text-muted-foreground mt-1 block max-w-56 text-xs whitespace-normal">
                          {row.rejectionReason}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {isAdBilled(row.campaign.status)
                        ? formatCOP(
                            adChargedToDate(row.campaign, row.pauses, today),
                          )
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.clicks}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>
    </div>
  )
}
