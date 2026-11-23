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
import type { CourierLedgerOrder } from '@/lib/couriers/ledger'
import { CARRYABLE_RULE } from '@/lib/payouts/sql'
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

// ---------------------------------------------------------------------------
// The courier ledger (supabase/migrations/20261124000300_courier_ledger.sql)
// ---------------------------------------------------------------------------

/** Mirror of `isCourierEntryEligible`, against the updated order `new`. */
export const COURIER_ENTRY_ELIGIBLE_RULE = {
  sql: "new.status = 'delivered' and new.type = 'delivery' and new.courier_id is not null and (new.payment_method = 'cash' or new.payment_status in ('paid', 'refunded'))",
  matches: (order: CourierLedgerOrder): boolean =>
    order.status === 'delivered' &&
    order.type === 'delivery' &&
    order.courier_id !== null &&
    (order.payment_method === 'cash' ||
      order.payment_status === 'paid' ||
      order.payment_status === 'refunded'),
}

/** Mirror of `courierEntryFor`'s two amounts. */
export const COURIER_EARNINGS_SQL = '(new.delivery_fee + new.tip)'
export const COURIER_CASH_SQL =
  "(case when new.payment_method = 'cash' then new.total else 0 end)"

/** Mirror of `cashOwedFor`, against an order `o` the courier holds. */
export const COURIER_CASH_OWED_SQL =
  "greatest(0, (case when o.payment_method = 'cash' then o.total else 0 end) - (o.delivery_fee + o.tip))"

/** Mirror of `courierPayoutNet`, against `totals t` and carried debt `ct`. */
export const COURIER_PAYOUT_NET_SQL =
  't.earnings - t.cash_collected + t.adjustments + coalesce(ct.carried_in, 0)'

/** The blocks the courier ledger migration embeds, by marker name. */
export function courierLedgerSqlBlocks(): Record<string, string> {
  return {
    courier_entry_eligible: COURIER_ENTRY_ELIGIBLE_RULE.sql,
    courier_earnings: COURIER_EARNINGS_SQL,
    courier_cash: COURIER_CASH_SQL,
    courier_cash_owed_in_progress: COURIER_CASH_OWED_SQL,
    courier_cash_owed_new: COURIER_CASH_OWED_SQL.replaceAll('o.', 'new.'),
    // The carry rule is the merchants' one, column for column.
    courier_carryable_lock: CARRYABLE_RULE.sql,
    courier_carryable: CARRYABLE_RULE.sql,
    courier_payout_net: COURIER_PAYOUT_NET_SQL,
  }
}
