// Paid placements ("Patrocinado"): the vocabulary. Pure, safe on client and
// server.
//
// MIRRORED IN SQL: the check constraints, the transition guard and the
// capacity count of supabase/migrations/20261124000900_ad_campaigns.sql embed
// these lists between `codegen:` markers; tests/ads-vocabulary-drift.test.ts
// compares them byte for byte.
import type { StatusTone } from '@/lib/orders/status'
import { sqlValueList } from '@/lib/refunds/vocabulary'

/** Where a sponsored store can appear. */
export const AD_PLACEMENTS = [
  'home_featured',
  'category_top',
  'search_top',
] as const
export type AdPlacement = (typeof AD_PLACEMENTS)[number]

export function isAdPlacement(value: unknown): value is AdPlacement {
  return (AD_PLACEMENTS as readonly unknown[]).includes(value)
}

export const AD_PLACEMENT_LABELS: Record<AdPlacement, string> = {
  home_featured: 'Destacados de la página principal',
  category_top: 'Primero en tu categoría',
  search_top: 'Primero en la búsqueda',
}

/** One line, for the merchant choosing a placement. */
export const AD_PLACEMENT_DESCRIPTIONS: Record<AdPlacement, string> = {
  home_featured:
    'Apareces al comienzo del carrusel "Destacados", lo primero que ven al entrar.',
  category_top:
    'Apareces de primero cuando alguien filtra por tu categoría en la página principal.',
  search_top:
    'Apareces de primero en las sugerencias cuando buscan tu categoría, tu nombre o uno de tus platos.',
}

/**
 * A campaign's life. `requested` waits for an admin; `active` runs between
 * its dates; `paused` holds its slot without running (and without being
 * charged); `ended` was stopped by an admin. `rejected` and `cancelled` never
 * ran.
 */
export const AD_STATUSES = [
  'requested',
  'active',
  'paused',
  'ended',
  'rejected',
  'cancelled',
] as const
export type AdStatus = (typeof AD_STATUSES)[number]

/** Every transition the database accepts. MIRRORED IN SQL. */
export const AD_TRANSITION_PAIRS: readonly (readonly [AdStatus, AdStatus])[] = [
  ['requested', 'active'],
  ['requested', 'rejected'],
  ['requested', 'cancelled'],
  ['active', 'paused'],
  ['paused', 'active'],
  ['active', 'ended'],
  ['paused', 'ended'],
]

export function canTransition(from: AdStatus, to: AdStatus): boolean {
  return AD_TRANSITION_PAIRS.some(([a, b]) => a === from && b === to)
}

/** Campaigns that hold one of the placement's slots on their dates. */
export const AD_HOLDING_STATUSES: readonly AdStatus[] = ['active', 'paused']

/**
 * Campaigns the settlement charges for: every status an approved campaign
 * can be in. The billable days decide how much (see lib/ads/billing.ts).
 */
export const AD_BILLED_STATUSES: readonly AdStatus[] = [
  'active',
  'paused',
  'ended',
]

/** Why a campaign is paused. A suspension is lifted with the store. */
export const AD_PAUSE_REASONS = ['admin', 'store_suspended'] as const
export type AdPauseReason = (typeof AD_PAUSE_REASONS)[number]

export const AD_PAUSE_REASON_LABELS: Record<AdPauseReason, string> = {
  admin: 'Pausada por Cerquita',
  store_suspended: 'Pausada: tienda suspendida',
}

/**
 * What a merchant and an admin read. `scheduled` and `finished` are computed
 * from the dates (see `adDisplayStatus`): an approved campaign does not
 * change status when its first or last day arrives.
 */
export type AdDisplayStatus = AdStatus | 'scheduled' | 'finished'

export const AD_STATUS_LABELS: Record<AdDisplayStatus, string> = {
  requested: 'Por aprobar',
  scheduled: 'Programada',
  active: 'Al aire',
  paused: 'Pausada',
  finished: 'Finalizada',
  ended: 'Terminada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
}

export const AD_STATUS_TONES: Record<AdDisplayStatus, StatusTone> = {
  requested: 'warning',
  scheduled: 'info',
  active: 'success',
  paused: 'neutral',
  finished: 'neutral',
  ended: 'neutral',
  rejected: 'destructive',
  cancelled: 'neutral',
}

/** The label every sponsored placement carries, visibly (Ley 1480). */
export const SPONSORED_LABEL = 'Patrocinado'

/** `('requested', 'active'), ...` for `(old.status, new.status) in (...)`. */
export function adTransitionPairsSql(): string {
  return AD_TRANSITION_PAIRS.map(([from, to]) => `('${from}', '${to}')`).join(
    ', ',
  )
}

/** The vocabulary blocks the ads migration embeds, by marker name. */
export function adVocabularySqlBlocks(): Record<string, string> {
  return {
    ad_placements: sqlValueList(AD_PLACEMENTS),
    ad_statuses: sqlValueList(AD_STATUSES),
    ad_pause_reasons_campaign: sqlValueList(AD_PAUSE_REASONS),
    ad_pause_reasons: sqlValueList(AD_PAUSE_REASONS),
    ad_transitions: adTransitionPairsSql(),
    ad_holding_statuses_capacity: sqlValueList(AD_HOLDING_STATUSES),
    ad_holding_statuses_duplicate: sqlValueList(AD_HOLDING_STATUSES),
  }
}
