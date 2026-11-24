'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { syncStoreCampaigns } from '@/lib/ads/server'
import {
  MISSING_FIELD_LABELS,
  missingForApproval,
} from '@/lib/couriers/profile'
import type { VehicleType } from '@/lib/couriers/vocabulary'
import { isUuid } from '@/lib/dashboard/active-store'
import { formatCOP } from '@/lib/format'
import { formatDateCO } from '@/lib/format-date'
import { logger } from '@/lib/log/logger'
import {
  courierPayoutNotification,
  fromPush,
  payoutNotification,
  storeReviewedNotification,
} from '@/lib/notifications/messages'
import { notify } from '@/lib/notifications/send'
import { bogotaDate } from '@/lib/plans'
import { courierReviewMessage } from '@/lib/push/messages'
import { recordRefund } from '@/lib/refunds/record'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  commissionPctSchema,
  periodDateSchema,
  storePlanSchema,
  storeStatusSchema,
  userRoleSchema,
  type StorePlanInput,
} from '@/lib/validations/admin'
import {
  courierLedgerEntrySchema,
  courierReviewSchema,
  type CourierLedgerEntryInput,
  type CourierReviewInput,
} from '@/lib/validations/courier'
import {
  refundInputSchema,
  type RefundFormInput,
} from '@/lib/validations/refunds'
import { requireRole } from '@/lib/auth'
import type { StoreStatus, UserRole } from '@/types/app'

export type AdminActionResult = { ok: true } | { ok: false; error: string }

const GENERIC_ERROR = 'No pudimos completar la acción. Inténtalo de nuevo.'

/** "17 nov 2026 – 23 nov 2026", as the payout tables show a period. */
function periodRange(start: string, end: string): string {
  const day = (value: string) => formatDateCO(new Date(`${value}T12:00:00`))
  return `${day(start)} – ${day(end)}`
}

/** Tells a store owner about one of their payouts. */
function notifyPayout(
  stage: 'generated' | 'paid',
  payout: {
    store_id: string
    net: number
    period_start: string
    period_end: string
  },
) {
  const net = Number(payout.net)
  return notify(
    { storeOwner: payout.store_id },
    payoutNotification({
      stage,
      periodLabel: periodRange(payout.period_start, payout.period_end),
      amountLabel: formatCOP(Math.abs(net)),
      owes: net < 0,
    }),
  )
}

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

export async function setStoreStatus(
  storeId: string,
  status: StoreStatus,
): Promise<AdminActionResult> {
  if (!isUuid(storeId)) return { ok: false, error: 'Tienda inválida.' }
  const parsed = storeStatusSchema.safeParse(status)
  if (!parsed.success) return { ok: false, error: 'Estado inválido.' }

  await requireRole(['admin'])
  const admin = createAdminClient()
  const { data: store, error } = await admin
    .from('stores')
    .update({ status: parsed.data })
    .eq('id', storeId)
    .select('name')
    .maybeSingle()
  if (error) {
    console.error('Failed to update store status', error)
    return { ok: false, error: 'No pudimos actualizar el estado de la tienda.' }
  }
  // A suspended store's sponsored placements pause (and stop being charged);
  // reactivating it resumes the ones the suspension paused.
  await syncStoreCampaigns(admin, storeId, parsed.data)

  revalidatePath('/admin/stores')
  revalidatePath('/admin')
  revalidatePath('/admin/publicidad')
  revalidatePath('/')
  if (store) {
    const storeStatus = parsed.data
    after(
      notify(
        { storeOwner: storeId },
        storeReviewedNotification({
          storeName: store.name,
          status: storeStatus,
        }),
      ),
    )
  }
  return { ok: true }
}

/**
 * Plan and founder date of a store. Admin-only, like the commission: the
 * protect_store_admin_columns trigger refuses both from anyone else.
 */
export async function setStorePlan(
  storeId: string,
  input: StorePlanInput,
): Promise<AdminActionResult> {
  if (!isUuid(storeId)) return { ok: false, error: 'Tienda inválida.' }
  const parsed = storePlanSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Plan inválido.',
    }
  }

  await requireRole(['admin'])
  const admin = createAdminClient()
  const { error } = await admin
    .from('stores')
    .update({
      plan: parsed.data.plan,
      founder_until: parsed.data.founderUntil,
    })
    .eq('id', storeId)
  if (error) {
    console.error('Failed to update store plan', error)
    return { ok: false, error: 'No pudimos actualizar el plan.' }
  }

  revalidatePath('/admin/stores')
  revalidatePath('/dashboard/payouts')
  revalidatePath('/')
  return { ok: true }
}

export async function setStoreCommission(
  storeId: string,
  commissionPct: number,
): Promise<AdminActionResult> {
  if (!isUuid(storeId)) return { ok: false, error: 'Tienda inválida.' }
  const parsed = commissionPctSchema.safeParse(commissionPct)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Comisión inválida.',
    }
  }

  await requireRole(['admin'])
  const admin = createAdminClient()
  const { error } = await admin
    .from('stores')
    .update({ commission_pct: parsed.data })
    .eq('id', storeId)
  if (error) {
    console.error('Failed to update store commission', error)
    return { ok: false, error: 'No pudimos actualizar la comisión.' }
  }

  revalidatePath('/admin/stores')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function setUserRole(
  userId: string,
  role: UserRole,
): Promise<AdminActionResult> {
  if (!isUuid(userId)) return { ok: false, error: 'Usuario inválido.' }
  const parsed = userRoleSchema.safeParse(role)
  if (!parsed.success) return { ok: false, error: 'Rol inválido.' }

  const { user } = await requireRole(['admin'])
  if (userId === user.id) {
    return { ok: false, error: 'No puedes cambiar tu propio rol.' }
  }

  const admin = createAdminClient()

  // The role claim used by middleware lives in auth.users.app_metadata, but
  // every read in the app goes through profiles.role, so both must move
  // together or the two views of "who is this user" fall out of sync. The
  // JWT claim is written first because middleware trusts it; if the profile
  // write then fails, the claim is rolled back to what it was.
  const { data: current, error: readError } =
    await admin.auth.admin.getUserById(userId)
  if (readError || !current.user) {
    console.error('Failed to read current auth role claim', readError)
    return { ok: false, error: GENERIC_ERROR }
  }
  const previousRole =
    (current.user.app_metadata as { role?: unknown } | null)?.role ?? null

  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role: parsed.data },
  })
  if (authError) {
    console.error('Failed to update auth role claim', authError)
    return { ok: false, error: GENERIC_ERROR }
  }

  const { error: profileError } = await admin
    .from('profiles')
    .update({ role: parsed.data })
    .eq('id', userId)
  if (profileError) {
    console.error('Failed to update profile role', profileError)
    const { error: rollbackError } = await admin.auth.admin.updateUserById(
      userId,
      { app_metadata: { role: previousRole } },
    )
    if (rollbackError) {
      console.error('Failed to restore previous auth role claim', {
        userId,
        previousRole,
        rollbackError,
      })
    }
    return { ok: false, error: GENERIC_ERROR }
  }

  revalidatePath('/admin/users')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Payouts
// ---------------------------------------------------------------------------

export type GeneratePayoutsResult =
  { ok: true; created: number; skipped: number } | { ok: false; error: string }

/**
 * Generates one period of payouts.
 *
 * ---------------------------------------------------------------------------
 * Why this is one database call
 * ---------------------------------------------------------------------------
 * It used to be five: read the eligible orders, read the pending refunds,
 * read the settled payouts, insert a payout row per store, stamp the refunds
 * that row carried. Every gap between them was a way to lose money.
 *
 *   * A stamp that failed left the deduction applied and the refund still
 *     pending, so `needsReversal` re-matched the same original payout on
 *     every later run and debited the merchant for the same refund every
 *     period, forever.
 *   * The orders snapshot was read before the refunds were. A refund recorded
 *     in that window left the snapshot reading `paid`, so the full sale was
 *     settled while the refund was stamped resolved with no adjustment: the
 *     clawback closed at zero, silently.
 *
 * PostgREST gives each call its own transaction, so those five cannot be made
 * atomic from here — the decisions have to be made where the transaction is.
 * `public.generate_payouts`
 * (`supabase/migrations/20260919000500_money_transactions.sql`) does the
 * whole run in one statement: one snapshot, one commit, eligibility re-read
 * inside it.
 *
 * The cost is that the eligibility and reversal rules exist twice — in
 * `lib/payouts/` and in that function. `lib/payouts/sql.ts` emits the SQL and
 * `tests/payouts-sql-drift.test.ts` fails the build when the two disagree.
 *
 * This action keeps the shape every other admin action has: validate,
 * re-authenticate, call, log, revalidate.
 */
export async function generatePayouts(
  periodStart: string,
  periodEnd: string,
): Promise<GeneratePayoutsResult> {
  const parsedStart = periodDateSchema.safeParse(periodStart)
  const parsedEnd = periodDateSchema.safeParse(periodEnd)
  if (!parsedStart.success || !parsedEnd.success || periodStart > periodEnd) {
    return { ok: false, error: 'Selecciona un periodo válido.' }
  }
  // A payout row closes its period for good (one per store and range), so a
  // period that has not ended yet would leave its remaining days unsettled.
  if (periodEnd >= bogotaDate(new Date())) {
    return {
      ok: false,
      error: 'Ese periodo todavía no termina. Liquida periodos ya cerrados.',
    }
  }

  await requireRole(['admin'])
  const admin = createAdminClient()
  // Payouts this run writes are the ones created from now on: running the
  // same period again notifies nobody twice.
  const startedAt = new Date().toISOString()

  const { data, error } = await admin.rpc('generate_payouts', {
    p_period_start: parsedStart.data,
    p_period_end: parsedEnd.data,
  })
  const row = Array.isArray(data) ? data[0] : data
  if (error || !row) {
    // Nothing was written: the run either committed whole or not at all, so
    // re-running after the cause is fixed is always safe.
    logger.error('payouts.generate_failed', { periodStart, periodEnd }, error)
    return {
      ok: false,
      error: 'No pudimos generar las liquidaciones. Inténtalo de nuevo.',
    }
  }

  logger.info('payouts.generated', {
    periodStart,
    periodEnd,
    created: row.payouts_created,
    skipped: row.payouts_skipped,
    // How many refunds produced a negative adjustment, and how many were
    // closed in total (an adjustment-free refund is still closed, or every
    // future run would reconsider it forever).
    reversed: row.refunds_reversed,
    resolved: row.refunds_resolved,
  })

  revalidatePath('/admin/payouts')
  revalidatePath('/dashboard/payouts')
  if (Number(row.payouts_created) > 0) {
    after(async () => {
      const { data: created, error: loadError } = await createAdminClient()
        .from('payouts')
        .select('store_id, net, period_start, period_end')
        .eq('period_start', parsedStart.data)
        .eq('period_end', parsedEnd.data)
        .gte('created_at', startedAt)
      if (loadError) {
        logger.error('payouts.notify_load_failed', { periodStart }, loadError)
        return
      }
      await Promise.all(
        (created ?? []).map((payout) => notifyPayout('generated', payout)),
      )
    })
  }
  return {
    ok: true,
    created: Number(row.payouts_created),
    skipped: Number(row.payouts_skipped),
  }
}

export async function markPayoutPaid(
  payoutId: string,
): Promise<AdminActionResult> {
  if (!isUuid(payoutId)) return { ok: false, error: 'Liquidación inválida.' }

  await requireRole(['admin'])
  const admin = createAdminClient()
  // Only an open row: a payout already paid, or a debt that a later payout
  // carried (`carried_into_payout_id`), is closed. Marking a carried debt paid
  // would withhold it twice; the database refuses too
  // (`payouts_carried_stays_pending`), this just says so in words.
  const { data, error } = await admin
    .from('payouts')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', payoutId)
    .eq('status', 'pending')
    .is('carried_into_payout_id', null)
    .select('id, store_id, net, period_start, period_end')
  if (error) {
    console.error('Failed to mark payout as paid', error)
    return {
      ok: false,
      error: 'No pudimos marcar la liquidación como pagada.',
    }
  }
  if (!data || data.length === 0) {
    return {
      ok: false,
      error:
        'Esta liquidación ya se pagó o su saldo se arrastró a un periodo posterior.',
    }
  }

  revalidatePath('/admin/payouts')
  revalidatePath('/dashboard/payouts')
  const paid = data[0]
  after(notifyPayout('paid', paid))
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

/**
 * Records a refund on any store's order. Same bookkeeping-only semantics as
 * the merchant action (`app/dashboard/actions.ts`): no payment provider is
 * called, by design — see `lib/refunds/gateway.ts`.
 *
 * This exists for the case the merchant cannot handle themselves: a charge
 * that landed on `/admin/payments` because it never reached its order, where
 * the platform is the one who has to put it right.
 */
export async function recordRefundAsAdmin(
  input: RefundFormInput,
): Promise<AdminActionResult> {
  const parsed = refundInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? 'Datos del reembolso inválidos.',
    }
  }

  const { user } = await requireRole(['admin'])
  const admin = createAdminClient()
  const { data: order, error } = await admin
    .from('orders')
    .select('id, store_id, total, status, payment_status, payment_method')
    .eq('id', parsed.data.orderId)
    .maybeSingle()
  if (error) {
    logger.error(
      'admin.refund.order_read_failed',
      { orderId: parsed.data.orderId },
      error,
    )
    return { ok: false, error: GENERIC_ERROR }
  }
  if (!order) return { ok: false, error: 'No encontramos el pedido.' }

  const result = await recordRefund({
    order: {
      id: order.id,
      store_id: order.store_id,
      total: Number(order.total),
      status: order.status,
      payment_status: order.payment_status,
      payment_method: order.payment_method,
    },
    input: {
      reason: parsed.data.reason,
      method: parsed.data.method,
      note: parsed.data.note ?? null,
    },
    issuedBy: user.id,
    actor: 'admin',
  })
  if (!result.ok) return result

  revalidatePath('/admin/payments')
  revalidatePath('/admin/orders')
  revalidatePath('/admin/payouts')
  revalidatePath(`/orders/${order.id}`)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Dish reviews: hidden, never deleted
// ---------------------------------------------------------------------------

/**
 * Hides a dish review (or shows it again). A hidden review stays in the
 * database for the record but is not shown and does not count: the trigger
 * recomputes the dish's average and count on every hide and show.
 */
export async function setProductReviewHidden(
  reviewId: string,
  hidden: boolean,
): Promise<AdminActionResult> {
  if (!isUuid(reviewId)) return { ok: false, error: 'Reseña inválida.' }
  await requireRole(['admin'])
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('product_reviews')
    .update({ hidden_at: hidden ? new Date().toISOString() : null })
    .eq('id', reviewId)
    .select('id, stores(slug)')
    .maybeSingle()
  if (error || !data) {
    logger.error(
      'admin.product_review.hide_failed',
      { reviewId, hidden },
      error,
    )
    return { ok: false, error: GENERIC_ERROR }
  }
  revalidatePath('/admin/reviews')
  if (data.stores?.slug) revalidatePath(`/t/${data.stores.slug}`)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Couriers
// ---------------------------------------------------------------------------

/**
 * Approves, suspends or sends back a courier's profile. Approval opens the
 * order pool (`is_active_courier()`); the database also refuses to approve an
 * incomplete profile (`courier_profiles_approved_complete`), this says which
 * field is missing first.
 */
export async function setCourierStatus(
  input: CourierReviewInput,
): Promise<AdminActionResult> {
  const parsed = courierReviewSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Datos inválidos.',
    }
  }
  const { userId, status, note } = parsed.data

  const { user } = await requireRole(['admin'])
  const admin = createAdminClient()
  const { data: profile, error: readError } = await admin
    .from('courier_profiles')
    .select(
      'vehicle_type, plate, document_number, city, license_expires_on, soat_expires_on',
    )
    .eq('user_id', userId)
    .maybeSingle()
  if (readError) {
    logger.error('admin.courier.read_failed', { userId }, readError)
    return { ok: false, error: GENERIC_ERROR }
  }
  if (!profile) {
    return {
      ok: false,
      error: 'Este domiciliario todavía no ha enviado su perfil.',
    }
  }

  if (status === 'approved') {
    const missing = missingForApproval({
      ...profile,
      vehicle_type: profile.vehicle_type as VehicleType | null,
    })
    if (missing.length > 0) {
      return {
        ok: false,
        error: `Falta ${missing.map((field) => MISSING_FIELD_LABELS[field]).join(', ')}.`,
      }
    }
  }

  const { error } = await admin
    .from('courier_profiles')
    .update({
      status,
      status_note: note,
      ...(status === 'approved'
        ? { approved_by: user.id, approved_at: new Date().toISOString() }
        : { approved_by: null, approved_at: null }),
    })
    .eq('user_id', userId)
  if (error) {
    logger.error('admin.courier.update_failed', { userId, status }, error)
    return { ok: false, error: GENERIC_ERROR }
  }

  after(
    notify(
      { userIds: [userId] },
      fromPush('courier_reviewed', courierReviewMessage(status, note)),
    ),
  )

  revalidatePath('/admin/domiciliarios')
  return { ok: true }
}

export type GenerateCourierPayoutsResult =
  { ok: true; created: number; skipped: number } | { ok: false; error: string }

/**
 * Settles the courier ledger into one payout per courier for a closed
 * period: what the platform owes them (delivery fees and tips of online
 * orders), minus the cash they collected, plus their deposits, plus any debt
 * carried from an earlier period. One transaction
 * (`public.generate_courier_payouts`), so a failed run writes nothing.
 */
export async function generateCourierPayouts(
  periodStart: string,
  periodEnd: string,
): Promise<GenerateCourierPayoutsResult> {
  const parsedStart = periodDateSchema.safeParse(periodStart)
  const parsedEnd = periodDateSchema.safeParse(periodEnd)
  if (!parsedStart.success || !parsedEnd.success || periodStart > periodEnd) {
    return { ok: false, error: 'Selecciona un periodo válido.' }
  }
  if (periodEnd >= bogotaDate(new Date())) {
    return {
      ok: false,
      error: 'Ese periodo todavía no termina. Liquida periodos ya cerrados.',
    }
  }

  await requireRole(['admin'])
  const startedAt = new Date().toISOString()
  const { data, error } = await createAdminClient().rpc(
    'generate_courier_payouts',
    { p_period_start: parsedStart.data, p_period_end: parsedEnd.data },
  )
  const row = Array.isArray(data) ? data[0] : data
  if (error || !row) {
    logger.error(
      'courier_payouts.generate_failed',
      { periodStart, periodEnd },
      error,
    )
    return {
      ok: false,
      error: 'No pudimos generar las liquidaciones. Inténtalo de nuevo.',
    }
  }
  logger.info('courier_payouts.generated', {
    periodStart,
    periodEnd,
    created: row.payouts_created,
    skipped: row.payouts_skipped,
    settled: row.entries_settled,
    carried: row.debts_carried,
  })

  revalidatePath('/admin/domiciliarios/liquidaciones')
  revalidatePath('/courier/ganancias')
  if (Number(row.payouts_created) > 0) {
    after(async () => {
      const { data: created, error: loadError } = await createAdminClient()
        .from('courier_payouts')
        .select('courier_id, net')
        .eq('period_start', parsedStart.data)
        .eq('period_end', parsedEnd.data)
        .gte('created_at', startedAt)
      if (loadError) {
        logger.error(
          'courier_payouts.notify_load_failed',
          { periodStart },
          loadError,
        )
        return
      }
      await Promise.all(
        (created ?? []).map((payout) =>
          notify(
            { userIds: [payout.courier_id] },
            courierPayoutNotification({
              stage: 'generated',
              amountLabel: formatCOP(Number(payout.net)),
            }),
          ),
        ),
      )
    })
  }
  return {
    ok: true,
    created: Number(row.payouts_created),
    skipped: Number(row.payouts_skipped),
  }
}

/** Marks an open courier payout paid; a carried debt is already closed. */
export async function markCourierPayoutPaid(
  payoutId: string,
): Promise<AdminActionResult> {
  if (!isUuid(payoutId)) return { ok: false, error: 'Liquidación inválida.' }

  await requireRole(['admin'])
  const { data, error } = await createAdminClient()
    .from('courier_payouts')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', payoutId)
    .eq('status', 'pending')
    .is('carried_into_payout_id', null)
    .select('id, courier_id, net')
  if (error) {
    logger.error('courier_payouts.mark_paid_failed', { payoutId }, error)
    return { ok: false, error: 'No pudimos marcar la liquidación como pagada.' }
  }
  if (!data || data.length === 0) {
    return {
      ok: false,
      error:
        'Esta liquidación ya se pagó o su saldo se arrastró a un periodo posterior.',
    }
  }
  revalidatePath('/admin/domiciliarios/liquidaciones')
  revalidatePath('/courier/ganancias')
  const paid = data[0]
  after(
    notify(
      { userIds: [paid.courier_id] },
      courierPayoutNotification({
        stage: 'paid',
        amountLabel: formatCOP(Number(paid.net)),
      }),
    ),
  )
  return { ok: true }
}

/**
 * Records cash a courier handed over (a deposit) or a correction. A deposit
 * pays their debt down at once, so a courier stopped by the cash cap can take
 * cash orders again right after it is recorded.
 */
export async function recordCourierLedgerEntry(
  input: CourierLedgerEntryInput,
): Promise<AdminActionResult> {
  const parsed = courierLedgerEntrySchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Datos inválidos.',
    }
  }
  const { courierId, kind, amount, note } = parsed.data

  const { user } = await requireRole(['admin'])
  const { error } = await createAdminClient()
    .from('courier_ledger')
    .insert({ courier_id: courierId, kind, amount, note, created_by: user.id })
  if (error) {
    logger.error('courier_ledger.insert_failed', { courierId, kind }, error)
    return { ok: false, error: GENERIC_ERROR }
  }
  revalidatePath('/admin/domiciliarios')
  revalidatePath('/courier/ganancias')
  if (kind === 'deposit') {
    after(
      notify(
        { userIds: [courierId] },
        courierPayoutNotification({
          stage: 'deposit',
          amountLabel: formatCOP(Math.abs(amount)),
        }),
      ),
    )
  }
  return { ok: true }
}
