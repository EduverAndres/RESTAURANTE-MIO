import 'server-only'

import { cache } from 'react'
import { planHas, planOfStore } from '@/lib/plans'
import type { ReservationConfig } from '@/lib/reservations/slots'
import { parseSchedule } from '@/lib/store/hours'
import { createClient } from '@/lib/supabase/server'
import type { ReservationSettingsRow, Store } from '@/types/app'

/** A store's reservation settings (public read), or null when never set. */
export const fetchReservationSettings = cache(
  async (storeId: string): Promise<ReservationSettingsRow | null> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('reservation_settings')
      .select('*')
      .eq('store_id', storeId)
      .maybeSingle()
    // The booking button is an extra: a failed read hides it rather than
    // breaking the storefront.
    if (error) {
      console.error('Failed to read reservation settings', error)
      return null
    }
    return data
  },
)

export function toReservationConfig(
  row: ReservationSettingsRow,
): ReservationConfig {
  return {
    slotMinutes: row.slot_minutes,
    coversPerSlot: row.covers_per_slot,
    maxPartySize: row.max_party_size,
    minLeadMinutes: row.min_lead_minutes,
    maxDaysAhead: row.max_days_ahead,
    durationMinutes: row.duration_minutes,
    blockedDates: row.blocked_dates,
  }
}

/**
 * Whether the store takes reservations right now: switched on, on a plan
 * that includes them, active, and with opening hours to offer times within.
 */
export function isReservable(
  store: Pick<Store, 'plan' | 'founder_until' | 'status' | 'schedule'>,
  settings: Pick<ReservationSettingsRow, 'enabled'> | null,
): boolean {
  return (
    settings?.enabled === true &&
    store.status === 'active' &&
    planHas(planOfStore(store), 'reservations') &&
    Object.keys(parseSchedule(store.schedule)).length > 0
  )
}
