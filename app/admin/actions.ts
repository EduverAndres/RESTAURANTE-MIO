'use server'

import { revalidatePath } from 'next/cache'
import { isUuid } from '@/lib/dashboard/active-store'
import {
  periodEndExclusive,
  summarizePayouts,
  type PayoutOrderInput,
} from '@/lib/payouts/compute'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  commissionPctSchema,
  periodDateSchema,
  storeStatusSchema,
  userRoleSchema,
} from '@/lib/validations/admin'
import { requireRole } from '@/lib/auth'
import type { StoreStatus, UserRole } from '@/types/app'

export type AdminActionResult = { ok: true } | { ok: false; error: string }

const UNIQUE_VIOLATION = '23505'
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

  const { data, error } = await admin
    .from('orders')
    .select(
      'store_id, status, subtotal, platform_fee, delivered_at, payment_method, payment_status',
    )
    .eq('status', 'delivered')
    .gte('delivered_at', `${periodStart}T00:00:00.000Z`)
    .lt('delivered_at', periodEndExclusive(periodEnd).toISOString())
    .limit(20000)
  if (error) {
    console.error('Failed to load orders for payouts', error)
    return { ok: false, error: 'No pudimos cargar los pedidos del periodo.' }
  }

  const orders: PayoutOrderInput[] = (data ?? []).map((order) => ({
    store_id: order.store_id,
    status: order.status,
    subtotal: Number(order.subtotal),
    platform_fee: Number(order.platform_fee),
    delivered_at: order.delivered_at,
    payment_method: order.payment_method,
    payment_status: order.payment_status,
  }))
  const rows = summarizePayouts(orders, { periodStart, periodEnd })

  let created = 0
  let skipped = 0
  for (const row of rows) {
    const { error: insertError } = await admin.from('payouts').insert({
      store_id: row.store_id,
      period_start: row.period_start,
      period_end: row.period_end,
      gross: row.gross,
      commission: row.commission,
      net: row.net,
    })
    if (insertError) {
      if (insertError.code === UNIQUE_VIOLATION) {
        skipped += 1
        continue
      }
      console.error('Failed to insert payout', insertError)
      return {
        ok: false,
        error: 'Generamos algunas liquidaciones, pero no todas. Reintenta.',
      }
    }
    created += 1
  }

  revalidatePath('/admin/payouts')
  return { ok: true, created, skipped }
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
