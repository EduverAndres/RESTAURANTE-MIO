'use server'

import { revalidatePath } from 'next/cache'
import { isUuid } from '@/lib/dashboard/active-store'
import { logger } from '@/lib/log/logger'
import { recordRefund } from '@/lib/refunds/record'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  commissionPctSchema,
  periodDateSchema,
  storeStatusSchema,
  userRoleSchema,
} from '@/lib/validations/admin'
import {
  refundInputSchema,
  type RefundFormInput,
} from '@/lib/validations/refunds'
import { requireRole } from '@/lib/auth'
import type { StoreStatus, UserRole } from '@/types/app'

export type AdminActionResult = { ok: true } | { ok: false; error: string }

const GENERIC_ERROR = 'No pudimos completar la acción. Inténtalo de nuevo.'

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
  const { error } = await admin
    .from('stores')
    .update({ status: parsed.data })
    .eq('id', storeId)
  if (error) {
    console.error('Failed to update store status', error)
    return { ok: false, error: 'No pudimos actualizar el estado de la tienda.' }
  }

  revalidatePath('/admin/stores')
  revalidatePath('/admin')
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
  | { ok: true; created: number; skipped: number }
  | { ok: false; error: string }

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

  await requireRole(['admin'])
  const admin = createAdminClient()

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
  const { error } = await admin
    .from('payouts')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', payoutId)
  if (error) {
    console.error('Failed to mark payout as paid', error)
    return {
      ok: false,
      error: 'No pudimos marcar la liquidación como pagada.',
    }
  }

  revalidatePath('/admin/payouts')
  revalidatePath('/dashboard/payouts')
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
      error: parsed.error.issues[0]?.message ?? 'Datos del reembolso inválidos.',
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
    logger.error('admin.refund.order_read_failed', { orderId: parsed.data.orderId }, error)
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
  revalidatePath('/admin/payouts')
  revalidatePath(`/orders/${order.id}`)
  return { ok: true }
}
