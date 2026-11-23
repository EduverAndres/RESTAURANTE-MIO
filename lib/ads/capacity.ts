// How many campaigns a placement fits on a day. Pure.
//
// A placement shows at most `max_slots` sponsored stores on any one day; for
// `category_top` the limit is per category, because each category page has
// its own top slot. A campaign holds its slot from approval until it is
// ended, paused days included (it can resume), so a request fits only if
// every one of its days has a free slot.
//
// MIRRORED IN SQL. `public.approve_ad_campaign` makes the same count under a
// lock on the placement row, which is what actually guarantees the limit; the
// merchant's quote and the request action use this module to say "no hay
// cupo" before anyone has to reject anything.
import { dayNumber } from '@/lib/ads/pricing'
import {
  AD_HOLDING_STATUSES,
  type AdPlacement,
  type AdStatus,
} from '@/lib/ads/vocabulary'
import { addDays } from '@/lib/store/hours'

export interface SlotCampaign {
  /** Optional: a campaign never competes with itself. */
  id?: string
  placement: AdPlacement
  status: AdStatus
  starts_on: string
  ends_on: string
  category_snapshot: string | null
}

export type SlotRequest = Omit<SlotCampaign, 'status'>

/** Category names compare case-insensitively, like `lower()` in SQL. */
function categoryKey(category: string | null): string | null {
  return category === null ? null : category.toLowerCase()
}

/** Whether two campaigns compete for the same slots. */
export function sharesSlotPool(
  a: Pick<SlotCampaign, 'placement' | 'category_snapshot'>,
  b: Pick<SlotCampaign, 'placement' | 'category_snapshot'>,
): boolean {
  if (a.placement !== b.placement) return false
  if (a.placement !== 'category_top') return true
  return categoryKey(a.category_snapshot) === categoryKey(b.category_snapshot)
}

function holdsSlot(campaign: SlotCampaign, day: string): boolean {
  return (
    AD_HOLDING_STATUSES.includes(campaign.status) &&
    campaign.starts_on <= day &&
    campaign.ends_on >= day
  )
}

/**
 * The most slots already taken on any day of `request`, by campaigns that
 * share its pool.
 */
export function peakOccupancy(
  campaigns: readonly SlotCampaign[],
  request: SlotRequest,
): number {
  const rivals = campaigns.filter(
    (campaign) =>
      (request.id === undefined || campaign.id !== request.id) &&
      sharesSlotPool(campaign, request),
  )
  let peak = 0
  for (
    let day = request.starts_on;
    dayNumber(day) <= dayNumber(request.ends_on);
    day = addDays(day, 1)
  ) {
    const taken = rivals.filter((campaign) => holdsSlot(campaign, day)).length
    if (taken > peak) peak = taken
  }
  return peak
}

/** Slots still free on the busiest day of `request` (never negative). */
export function freeSlots(
  campaigns: readonly SlotCampaign[],
  request: SlotRequest,
  maxSlots: number,
): number {
  return Math.max(0, maxSlots - peakOccupancy(campaigns, request))
}

/** Whether `request` fits on every one of its days. */
export function hasCapacity(
  campaigns: readonly SlotCampaign[],
  request: SlotRequest,
  maxSlots: number,
): boolean {
  return freeSlots(campaigns, request, maxSlots) > 0
}
