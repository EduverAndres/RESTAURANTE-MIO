'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { formatAdRange } from '@/lib/ads/pricing'
import {
  AD_PLACEMENT_LABELS,
  isAdPlacement,
  type AdStatus,
} from '@/lib/ads/vocabulary'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/log/logger'
import { bogotaDate } from '@/lib/plans'
import { adStatusNotification, fromPush } from '@/lib/notifications/messages'
import { notify } from '@/lib/notifications/send'
import { adCampaignReviewMessage } from '@/lib/push/messages'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  adCampaignIdSchema,
  adPlacementSchema,
  adRejectSchema,
  adStatusActionSchema,
  type AdPlacementInput,
  type AdRejectInput,
  type AdStatusActionInput,
} from '@/lib/validations/ads'

export type AdAdminResult = { ok: true } | { ok: false; error: string }

const GENERIC = 'No pudimos completar la acción. Inténtalo de nuevo.'

const APPROVAL_ERRORS: Record<string, string> = {
  not_found: 'No encontramos esa campaña.',
  not_requested: 'Esa solicitud ya fue revisada.',
  expired: 'Las fechas de esa solicitud ya pasaron. Recházala con ese motivo.',
  store_inactive: 'La tienda no está activa: no puede salir al aire.',
  duplicate:
    'La tienda ya tiene una campaña en esa ubicación para esas fechas.',
  full: 'No quedan cupos en esa ubicación para esas fechas.',
}

function revalidateAds() {
  revalidatePath('/admin/publicidad')
  revalidatePath('/dashboard/publicidad')
  revalidatePath('/')
}

/** What the push says about a campaign: "Primero en la búsqueda, 1 dic – 7 dic". */
async function describeCampaign(campaignId: string) {
  const { data } = await createAdminClient()
    .from('ad_campaigns')
    .select('store_id, placement, starts_on, ends_on')
    .eq('id', campaignId)
    .maybeSingle()
  if (!data) return null
  return {
    storeId: data.store_id,
    placement: isAdPlacement(data.placement)
      ? AD_PLACEMENT_LABELS[data.placement]
      : data.placement,
    dates: formatAdRange(data.starts_on, data.ends_on),
  }
}

/**
 * Approves a request. The slot limit, the late start and the one-campaign-
 * per-store rule are decided by `approve_ad_campaign`, which locks the
 * placement so two approvals cannot share its last slot.
 */
export async function approveAdCampaign(input: {
  campaignId: string
}): Promise<AdAdminResult> {
  const parsed = adCampaignIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Campaña inválida.' }
  const { user } = await requireRole(['admin'])
  const { campaignId } = parsed.data

  const { data: outcome, error } = await createAdminClient().rpc(
    'approve_ad_campaign',
    { p_id: campaignId, p_admin: user.id },
  )
  if (error) {
    logger.error('ads.approve_failed', { campaignId }, error)
    return { ok: false, error: GENERIC }
  }
  if (outcome !== 'ok') {
    return { ok: false, error: APPROVAL_ERRORS[outcome ?? ''] ?? GENERIC }
  }

  revalidateAds()
  after(async () => {
    const campaign = await describeCampaign(campaignId)
    if (!campaign) return
    await notify(
      { storeOwner: campaign.storeId },
      fromPush(
        'ad_reviewed',
        adCampaignReviewMessage({ decision: 'approved', ...campaign }),
      ),
    )
  })
  return { ok: true }
}

/** Turns a request down, with the reason the merchant will read. */
export async function rejectAdCampaign(
  input: AdRejectInput,
): Promise<AdAdminResult> {
  const parsed = adRejectSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Revisa el motivo.',
    }
  }
  await requireRole(['admin'])
  const { campaignId, reason } = parsed.data

  const { data, error } = await createAdminClient()
    .from('ad_campaigns')
    .update({ status: 'rejected', rejection_reason: reason })
    .eq('id', campaignId)
    .eq('status', 'requested')
    .select('id')
  if (error) {
    logger.error('ads.reject_failed', { campaignId }, error)
    return { ok: false, error: GENERIC }
  }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Esa solicitud ya fue revisada.' }
  }

  revalidateAds()
  after(async () => {
    const campaign = await describeCampaign(campaignId)
    if (!campaign) return
    await notify(
      { storeOwner: campaign.storeId },
      fromPush(
        'ad_reviewed',
        adCampaignReviewMessage({ decision: 'rejected', reason, ...campaign }),
      ),
    )
  })
  return { ok: true }
}

const MOVES: Record<
  AdStatusActionInput['action'],
  { from: AdStatus[]; to: AdStatus }
> = {
  pause: { from: ['active'], to: 'paused' },
  resume: { from: ['paused'], to: 'active' },
  end: { from: ['active', 'paused'], to: 'ended' },
}

/**
 * Pauses, resumes or ends an approved campaign. A compare-and-set on the
 * statuses the move starts from; the pause log is written by trigger in the
 * same statement, so the days it covers are never charged.
 */
export async function setAdCampaignStatus(
  input: AdStatusActionInput,
): Promise<AdAdminResult> {
  const parsed = adStatusActionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Acción inválida.' }
  await requireRole(['admin'])
  const { campaignId, action } = parsed.data
  const move = MOVES[action]
  const admin = createAdminClient()

  if (action === 'resume') {
    const { data: campaign } = await admin
      .from('ad_campaigns')
      .select('ends_on, stores(status)')
      .eq('id', campaignId)
      .maybeSingle()
    if (!campaign) return { ok: false, error: 'No encontramos esa campaña.' }
    if (campaign.stores?.status !== 'active') {
      return {
        ok: false,
        error: 'La tienda no está activa: reactívala antes de reanudar.',
      }
    }
    if (campaign.ends_on < bogotaDate(new Date())) {
      return {
        ok: false,
        error: 'Sus fechas ya pasaron. Termínala en lugar de reanudarla.',
      }
    }
  }

  const { data, error } = await admin
    .from('ad_campaigns')
    .update(
      action === 'pause'
        ? { status: move.to, pause_reason: 'admin' }
        : { status: move.to },
    )
    .eq('id', campaignId)
    .in('status', move.from)
    .select('id')
  if (error) {
    logger.error('ads.status_failed', { campaignId, action }, error)
    return { ok: false, error: GENERIC }
  }
  if (!data || data.length === 0) {
    return { ok: false, error: 'La campaña cambió mientras tanto. Recarga.' }
  }

  revalidateAds()
  const change = (
    { pause: 'paused', resume: 'resumed', end: 'ended' } as const
  )[action]
  after(async () => {
    const campaign = await describeCampaign(campaignId)
    if (!campaign) return
    await notify(
      { storeOwner: campaign.storeId },
      adStatusNotification({ change, placement: campaign.placement }),
    )
  })
  return { ok: true }
}

/**
 * Edits one row of the price list. A new price applies to requests made
 * from now on: every campaign keeps the price it was asked at.
 */
export async function saveAdPlacement(
  input: AdPlacementInput,
): Promise<AdAdminResult> {
  const parsed = adPlacementSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Revisa los valores.',
    }
  }
  await requireRole(['admin'])
  const values = parsed.data

  const { error } = await createAdminClient()
    .from('ad_placements')
    .update({
      daily_price: values.dailyPrice,
      max_slots: values.maxSlots,
      min_days: values.minDays,
      max_days: values.maxDays,
      active: values.active,
    })
    .eq('placement', values.placement)
  if (error) {
    logger.error('ads.placement_failed', { placement: values.placement }, error)
    return { ok: false, error: GENERIC }
  }

  revalidatePath('/admin/publicidad')
  revalidatePath('/dashboard/publicidad')
  revalidatePath('/para-restaurantes')
  return { ok: true }
}
