import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_PLAN_FEES, isPlanId, type PlanId } from '@/lib/plans'
import type { Database } from '@/types/database'

/**
 * Monthly fee per plan, read from `public.plans`, the only place prices are
 * set. Falls back to the seeded defaults when the table cannot be read (for
 * instance before migration 20261105000100 is applied), so a price screen
 * never renders empty.
 */
export async function fetchPlanFees(
  supabase: SupabaseClient<Database>,
): Promise<Record<PlanId, number>> {
  const fees = { ...DEFAULT_PLAN_FEES }
  try {
    const { data, error } = await supabase
      .from('plans')
      .select('id, monthly_fee')
    if (error || !data) return fees
    for (const row of data) {
      if (isPlanId(row.id)) fees[row.id] = Number(row.monthly_fee)
    }
  } catch {
    // Keep the defaults.
  }
  return fees
}
