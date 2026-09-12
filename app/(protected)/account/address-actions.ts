'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { addressSchema, type AddressInput } from '@/lib/validations/checkout'
import type { Address } from '@/types/app'

export type AddressActionResult =
  { ok: true; address: Address } | { ok: false; error: string }

const SESSION_EXPIRED = 'Tu sesión expiró. Inicia sesión de nuevo.'

function revalidateAddressPages() {
  revalidatePath('/account')
  revalidatePath('/checkout')
}

export async function saveAddress(
  input: AddressInput,
  addressId?: string,
): Promise<AddressActionResult> {
  const parsed = addressSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Revisa la dirección.',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: SESSION_EXPIRED }

  const { data: existing } = await supabase
    .from('addresses')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
  const isFirst = (existing ?? []).length === 0 && !addressId
  const values = {
    ...parsed.data,
    is_default: parsed.data.is_default || isFirst,
  }

  if (values.is_default) {
    await supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('user_id', user.id)
  }

  const query = addressId
    ? supabase
        .from('addresses')
        .update(values)
        .eq('id', addressId)
        .eq('user_id', user.id)
        .select('*')
        .single()
    : supabase
        .from('addresses')
        .insert({ ...values, user_id: user.id })
        .select('*')
        .single()

  const { data, error } = await query
  if (error || !data) {
    console.error('Failed to save address', error)
    return {
      ok: false,
      error: 'No pudimos guardar la dirección. Inténtalo de nuevo.',
    }
  }

  revalidateAddressPages()
  return { ok: true, address: data }
}

export async function deleteAddress(
  addressId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: SESSION_EXPIRED }

  const { error } = await supabase
    .from('addresses')
    .delete()
    .eq('id', addressId)
    .eq('user_id', user.id)
  if (error) {
    console.error('Failed to delete address', error)
    return { ok: false, error: 'No pudimos eliminar la dirección.' }
  }
  revalidateAddressPages()
  return { ok: true }
}

export async function setDefaultAddress(
  addressId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: SESSION_EXPIRED }

  await supabase
    .from('addresses')
    .update({ is_default: false })
    .eq('user_id', user.id)
  const { error } = await supabase
    .from('addresses')
    .update({ is_default: true })
    .eq('id', addressId)
    .eq('user_id', user.id)
  if (error) return { ok: false, error: 'No pudimos actualizar la dirección.' }
  revalidateAddressPages()
  return { ok: true }
}
