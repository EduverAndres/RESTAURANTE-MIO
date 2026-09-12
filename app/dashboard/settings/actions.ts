'use server'

import { revalidatePath } from 'next/cache'
import { isUuid } from '@/lib/dashboard/active-store'
import { createClient } from '@/lib/supabase/server'
import { storeThemeSchema, type StoreThemeInput } from '@/lib/validations/theme'

type Result = { ok: true } | { ok: false; error: string }

const SESSION_EXPIRED = 'Tu sesión expiró. Inicia sesión de nuevo.'

/** Validates and writes the complete theme object to `stores.theme`. */
export async function updateStoreTheme(
  storeId: string,
  input: StoreThemeInput,
): Promise<Result> {
  if (!isUuid(storeId)) return { ok: false, error: 'Tienda inválida.' }
  const parsed = storeThemeSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Revisa los datos del tema.',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: SESSION_EXPIRED }

  const { data, error } = await supabase
    .from('stores')
    .update({ theme: parsed.data })
    .eq('id', storeId)
    .eq('owner_id', user.id)
    .select('slug')
  if (error) {
    console.error('Failed to update store theme', error)
    return {
      ok: false,
      error: 'No pudimos guardar el tema. Inténtalo de nuevo.',
    }
  }
  if (!data || data.length === 0)
    return { ok: false, error: 'No encontramos la tienda.' }

  revalidatePath('/dashboard/settings')
  revalidatePath(`/t/${data[0].slug}`)
  return { ok: true }
}
