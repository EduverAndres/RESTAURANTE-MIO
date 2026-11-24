'use server'

import { revalidatePath } from 'next/cache'
import { hasCapacity, overlapsOwn, type SlotCampaign } from '@/lib/ads/capacity'
import { quoteAdCampaign } from '@/lib/ads/pricing'
import { AD_HOLDING_STATUSES, type AdStatus } from '@/lib/ads/vocabulary'
import { requireActiveStoreRow } from '@/lib/dashboard/store-context'
import { logger } from '@/lib/log/logger'
import { bogotaDate } from '@/lib/plans'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  adCampaignIdSchema,
  adRequestSchema,
  type AdRequestInput,
} from '@/lib/validations/ads'

export type AdActionResult = { ok: true } | { ok: false; error: string }

const GENERIC = 'No pudimos guardar la solicitud. Inténtalo de nuevo.'

/** Requests a store may have waiting for an answer at once. */
const MAX_OPEN_REQUESTS = 3

/**
 * Asks for a sponsored campaign. The price per day is read from the price
 * list now and frozen on the campaign; the dates are checked by the same
 * quote the form shows. Capacity is checked here so the merchant hears "no
 * hay cupo" at once, but it is only a courtesy: the admin's approval
 * (`approve_ad_campaign`) recounts the slots under a lock. Written with the
 * service role after proving the store is the caller's.
 */
export async function requestAdCampaign(
  input: AdRequestInput,
): Promise<AdActionResult> {
  const parsed = adRequestSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Revisa la solicitud.',
    }
  }
  const { placement, startsOn, endsOn } = parsed.data
  const { store, userId } = await requireActiveStoreRow('/dashboard/publicidad')
  if (store.status !== 'active') {
    return {
      ok: false,
      error:
        'Tu tienda debe estar aprobada y activa para anunciarse en Cerquita.',
    }
  }
  const category = store.category?.trim() || null
  if (placement === 'category_top' && !category) {
    return {
      ok: false,
      error:
        'Elige la categoría de tu tienda en Tienda antes de anunciarte en una categoría.',
    }
  }

  const admin = createAdminClient()
  const [
    { data: settings, error: settingsError },
    { data: rivals, error: rivalsError },
    { count: openRequests, error: openError },
  ] = await Promise.all([
    admin
      .from('ad_placements')
      .select('*')
      .eq('placement', placement)
      .maybeSingle(),
    admin
      .from('ad_campaigns')
      .select(
        'id, store_id, placement, status, starts_on, ends_on, category_snapshot',
      )
      .eq('placement', placement)
      .in('status', ['requested', ...AD_HOLDING_STATUSES])
      .lte('starts_on', endsOn)
      .gte('ends_on', startsOn),
    admin
      .from('ad_campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', store.id)
      .eq('status', 'requested'),
  ])
  if (settingsError || rivalsError || openError) {
    logger.error(
      'ads.request_load_failed',
      { storeId: store.id },
      settingsError ?? rivalsError ?? openError,
    )
    return { ok: false, error: GENERIC }
  }
  if (!settings) {
    return { ok: false, error: 'Esa ubicación no existe.' }
  }

  const quote = quoteAdCampaign({
    settings: {
      daily_price: Number(settings.daily_price),
      min_days: settings.min_days,
      max_days: settings.max_days,
      active: settings.active,
    },
    startsOn,
    endsOn,
    today: bogotaDate(new Date()),
  })
  if (!quote.ok) return { ok: false, error: quote.message }

  if ((openRequests ?? 0) >= MAX_OPEN_REQUESTS) {
    return {
      ok: false,
      error: `Ya tienes ${MAX_OPEN_REQUESTS} solicitudes esperando respuesta. Espera a que las revisemos.`,
    }
  }
  const request = {
    placement,
    starts_on: startsOn,
    ends_on: endsOn,
    category_snapshot: category,
  }
  const asSlot = (row: NonNullable<typeof rivals>[number]): SlotCampaign => ({
    id: row.id,
    placement,
    status: row.status as AdStatus,
    starts_on: row.starts_on,
    ends_on: row.ends_on,
    category_snapshot: row.category_snapshot,
  })
  if (
    overlapsOwn(
      (rivals ?? []).filter((row) => row.store_id === store.id).map(asSlot),
      request,
    )
  ) {
    return {
      ok: false,
      error: 'Ya tienes una campaña en esa ubicación para esas fechas.',
    }
  }
  // Waiting requests do not hold a slot: only approved campaigns count.
  if (!hasCapacity((rivals ?? []).map(asSlot), request, settings.max_slots)) {
    return {
      ok: false,
      error:
        'No quedan cupos en esa ubicación para esas fechas. Prueba con otras fechas.',
    }
  }

  const { error } = await admin.from('ad_campaigns').insert({
    store_id: store.id,
    placement,
    starts_on: startsOn,
    ends_on: endsOn,
    daily_price: Number(settings.daily_price),
    category_snapshot: category,
    requested_by: userId,
  })
  if (error) {
    logger.error('ads.request_failed', { storeId: store.id }, error)
    return { ok: false, error: GENERIC }
  }

  revalidatePath('/dashboard/publicidad')
  revalidatePath('/admin/publicidad')
  return { ok: true }
}

/**
 * Withdraws a request that has not been decided yet. A compare-and-set on
 * `requested`: once an admin approved it, the days are booked and only the
 * Cerquita team can stop it.
 */
export async function cancelAdRequest(input: {
  campaignId: string
}): Promise<AdActionResult> {
  const parsed = adCampaignIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Campaña inválida.' }
  const { store } = await requireActiveStoreRow('/dashboard/publicidad')

  const { data, error } = await createAdminClient()
    .from('ad_campaigns')
    .update({ status: 'cancelled' })
    .eq('id', parsed.data.campaignId)
    .eq('store_id', store.id)
    .eq('status', 'requested')
    .select('id')
  if (error) {
    logger.error(
      'ads.cancel_failed',
      { campaignId: parsed.data.campaignId },
      error,
    )
    return { ok: false, error: 'No pudimos cancelar la solicitud.' }
  }
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: 'Esa solicitud ya fue revisada y no se puede cancelar desde aquí.',
    }
  }

  revalidatePath('/dashboard/publicidad')
  revalidatePath('/admin/publicidad')
  return { ok: true }
}
