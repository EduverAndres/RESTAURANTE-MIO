'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { profileSchema, type ProfileInput } from '@/lib/validations/auth'

export type ProfileActionResult = { ok: true } | { ok: false; error: string }

export async function updateProfile(
  input: ProfileInput,
): Promise<ProfileActionResult> {
  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Revisa los datos ingresados.',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    return { ok: false, error: 'Tu sesión expiró. Inicia sesión de nuevo.' }

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: parsed.data.full_name, phone: parsed.data.phone })
    .eq('id', user.id)

  if (error) {
    console.error('Failed to update profile', error)
    return {
      ok: false,
      error: 'No pudimos guardar los cambios. Inténtalo de nuevo.',
    }
  }

  revalidatePath('/account')
  return { ok: true }
}
