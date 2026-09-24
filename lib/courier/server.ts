import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CourierAddress } from '@/lib/courier/orders'
import type { LatLng } from '@/lib/geo'
import { logger } from '@/lib/log/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/types/database'

// Addresses are owner-only and profiles are only readable between related
// parties under RLS, so the courier/customer pages fetch these two pieces
// with the service role AFTER the order itself was loaded through the RLS
// client (which proves the caller may see it). Every helper degrades to an
// empty result when the admin key is missing or the query fails.

export type DeliveryAddress = CourierAddress & {
  id: string
  label: string | null
}

export async function fetchAddressesById(
  ids: readonly (string | null)[],
): Promise<Map<string, DeliveryAddress>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  const result = new Map<string, DeliveryAddress>()
  if (unique.length === 0) return result
  try {
    const { data, error } = await createAdminClient()
      .from('addresses')
      .select('id, label, line1, line2, lat, lng')
      .in('id', unique)
    if (error) throw error
    for (const address of data ?? []) result.set(address.id, address)
  } catch (error) {
    logger.error(
      'courier.addresses.load_failed',
      { count: unique.length },
      error,
    )
  }
  return result
}

export async function fetchProfileName(
  id: string | null | undefined,
): Promise<string | null> {
  if (!id) return null
  try {
    const { data, error } = await createAdminClient()
      .from('profiles')
      .select('full_name')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data?.full_name?.trim() || null
  } catch (error) {
    logger.error('courier.profile_name.load_failed', undefined, error)
    return null
  }
}

export interface CourierPosition extends LatLng {
  heading: number | null
  /** Reported GPS accuracy in metres, when the device said. */
  accuracyM: number | null
  updatedAt: string
}

/** Last published position of a courier, read under the caller's RLS. */
export async function fetchCourierPosition(
  supabase: SupabaseClient<Database>,
  courierId: string | null | undefined,
): Promise<CourierPosition | null> {
  if (!courierId) return null
  const { data } = await supabase
    .from('courier_locations')
    .select('lat, lng, heading, accuracy_m, updated_at')
    .eq('courier_id', courierId)
    .maybeSingle()
  if (!data) return null
  return {
    lat: data.lat,
    lng: data.lng,
    heading: data.heading,
    accuracyM: data.accuracy_m === null ? null : Number(data.accuracy_m),
    updatedAt: data.updated_at,
  }
}
