// SQL mirrors of the courier rules. Pure.
//
// `public.is_active_courier()` decides, inside RLS, whether the order pool is
// open to the current user, so the approval rule exists twice: here and in
// `lib/couriers/profile.ts`. tests/couriers-sql-drift.test.ts compares the
// two over every combination and checks the migration embeds these strings
// verbatim between `codegen:` markers.
import {
  isCourierActive,
  type CourierProfileFacts,
} from '@/lib/couriers/profile'
import {
  COURIER_STATUSES,
  MOTORIZED_VEHICLES,
  VEHICLE_TYPES,
} from '@/lib/couriers/vocabulary'
import { sqlValueList } from '@/lib/refunds/vocabulary'

/**
 * Mirror of `isCourierActive`, against `courier_profiles cp` and a date-only
 * `v_today` (Bogotá). A null expiry fails the comparison, as in TypeScript.
 */
export const COURIER_ACTIVE_RULE = {
  sql: `cp.status = 'approved' and (cp.vehicle_type not in (${sqlValueList(MOTORIZED_VEHICLES)}) or (cp.license_expires_on >= v_today and cp.soat_expires_on >= v_today))`,
  matches: (
    profile: Pick<
      CourierProfileFacts,
      'status' | 'vehicle_type' | 'license_expires_on' | 'soat_expires_on'
    >,
    today: string,
  ): boolean => {
    if (profile.status !== 'approved') return false
    // `vehicle_type not in (...)` is NULL for a null vehicle, and NULL OR
    // false is not true: an approved profile without a vehicle does not pass.
    if (profile.vehicle_type === null) return false
    if (!MOTORIZED_VEHICLES.includes(profile.vehicle_type)) return true
    return (
      profile.license_expires_on !== null &&
      profile.soat_expires_on !== null &&
      profile.license_expires_on >= today &&
      profile.soat_expires_on >= today
    )
  },
}

/** The blocks the courier profiles migration embeds, by marker name. */
export function courierSqlBlocks(): Record<string, string> {
  return {
    courier_statuses: sqlValueList(COURIER_STATUSES),
    vehicle_types: sqlValueList(VEHICLE_TYPES),
    motorized_vehicles: sqlValueList(MOTORIZED_VEHICLES),
    courier_active: COURIER_ACTIVE_RULE.sql,
  }
}

// Re-exported so the drift test compares against the rule the app uses.
export { isCourierActive }
