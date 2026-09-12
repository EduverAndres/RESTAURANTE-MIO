'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { reviewSchema, type ReviewInput } from '@/lib/validations/checkout'

type Result = { ok: true } | { ok: false; error: string }

const SESSION_EXPIRED = 'Tu sesión expiró. Inicia sesión de nuevo.'

export async function cancelOrder(orderId: string): Promise<Result> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: SESSION_EXPIRED }

  // RLS only allows pending → cancelled by the customer, so a non-pending
  // order simply matches zero rows.
  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', orderId)
    .eq('customer_id', user.id)
    .eq('status', 'pending')
    .select('id')
  if (error) {
    console.error('Failed to cancel order', error)
    return { ok: false, error: 'No pudimos cancelar el pedido.' }
  }
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: 'El restaurante ya aceptó el pedido; contáctalo para cancelarlo.',
    }
  }
  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/account')
  return { ok: true }
}

export async function submitReview(input: ReviewInput): Promise<Result> {
  const parsed = reviewSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Revisa tu valoración.',
    }
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: SESSION_EXPIRED }

  const { data: order } = await supabase
    .from('orders')
    .select('id, store_id, status')
    .eq('id', parsed.data.orderId)
    .eq('customer_id', user.id)
    .maybeSingle()
  if (!order || order.status !== 'delivered') {
    return { ok: false, error: 'Solo puedes valorar pedidos entregados.' }
  }

  const { error } = await supabase.from('reviews').insert({
    order_id: order.id,
    store_id: order.store_id,
    customer_id: user.id,
    rating: parsed.data.rating,
    comment: parsed.data.comment || null,
  })
  if (error) {
    console.error('Failed to save review', error)
    return {
      ok: false,
      error:
        error.code === '23505'
          ? 'Ya valoraste este pedido.'
          : 'No pudimos guardar tu valoración.',
    }
  }
  revalidatePath(`/orders/${order.id}`)
  return { ok: true }
}
