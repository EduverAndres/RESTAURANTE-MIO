import 'server-only'

import type { CourierProfileFacts } from '@/lib/couriers/profile'
import type { CourierStatus, VehicleType } from '@/lib/couriers/vocabulary'
import type { createClient } from '@/lib/supabase/server'
import { throwOnQueryError } from '@/lib/supabase/query-error'
import type { CourierProfileRow } from '@/types/app'

type Client = Awaited<ReturnType<typeof createClient>>

export type CourierProfile = CourierProfileFacts &
  Pick<CourierProfileRow, 'zone' | 'status_note' | 'submitted_at'>

/** Narrows the text columns the database checks into their vocabularies. */
export function toCourierProfile(row: CourierProfileRow): CourierProfile {
  return {
    status: row.status as CourierStatus,
    vehicle_type: row.vehicle_type as VehicleType | null,
    plate: row.plate,
    document_number: row.document_number,
    city: row.city,
    zone: row.zone,
    license_expires_on: row.license_expires_on,
    soat_expires_on: row.soat_expires_on,
    status_note: row.status_note,
    submitted_at: row.submitted_at,
  }
}

/** The signed-in courier's own profile, read under RLS; null before the first save. */
export async function fetchOwnCourierProfile(
  supabase: Client,
  userId: string,
): Promise<CourierProfile | null> {
  const { data, error } = await supabase
    .from('courier_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  throwOnQueryError(error, 'own courier profile')
  return data ? toCourierProfile(data) : null
}
