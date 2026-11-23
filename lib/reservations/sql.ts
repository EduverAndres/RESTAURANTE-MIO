// SQL mirrors of the reservation rules. Pure. The migration embeds these
// strings between `codegen:` markers; tests/reservations-sql-drift.test.ts
// checks them byte for byte.
import { sqlValueList } from '@/lib/refunds/vocabulary'
import { RESERVATION_TRANSITION_PAIRS } from '@/lib/reservations/transitions'
import {
  ACTIVE_STATUSES,
  HOLDING_STATUSES,
  RESERVATION_OCCASIONS,
  RESERVATION_STATUSES,
} from '@/lib/reservations/vocabulary'

/** `('pending', 'confirmed'), ...` for `(old.status, new.status) in (...)`. */
export function transitionPairsSql(): string {
  return RESERVATION_TRANSITION_PAIRS.map(
    ([from, to]) => `('${from}', '${to}')`,
  ).join(', ')
}

export function reservationSqlBlocks(): Record<string, string> {
  return {
    reservation_statuses: sqlValueList(RESERVATION_STATUSES),
    reservation_occasions: sqlValueList(RESERVATION_OCCASIONS),
    reservation_transitions: transitionPairsSql(),
    holding_statuses: sqlValueList(HOLDING_STATUSES),
    active_statuses_index: sqlValueList(ACTIVE_STATUSES),
    active_statuses_limit: sqlValueList(ACTIVE_STATUSES),
    active_statuses_duplicate: sqlValueList(ACTIVE_STATUSES),
  }
}
