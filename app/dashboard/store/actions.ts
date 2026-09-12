'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { ACTIVE_STORE_COOKIE, isUuid } from '@/lib/dashboard/active-store'
import { isValidSlug } from '@/lib/slug'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  ACCEPTED_ASSET_TYPES,
  MAX_ASSET_BYTES,
  STORE_ASSET_KINDS,
  assetObjectPath,
  createStoreSchema,
  storeSettingsSchema,
  type CreateStoreInput,
  type StoreAssetKind,
  type StoreSettingsInput,
} from '@/lib/validations/store'

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

const SESSION_EXPIRED = 'Tu sesión expiró. Inicia sesión de nuevo.'
const SLUG_TAKEN = 'Esa dirección web ya está en uso. Prueba con otra.'
const UNIQUE_VIOLATION = '23505'
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

function revalidateStorePages(slug?: string) {
  revalidatePath('/dashboard', 'layout')
  if (slug) revalidatePath(`/t/${slug}`)
}

// ---------------------------------------------------------------------------
// Slug availability
// ---------------------------------------------------------------------------

/**
 * Owners only see active stores plus their own through RLS, so a pending
 * store from another owner would look free. The service-role client reads
 * only the id column to give an honest answer; it degrades to the RLS
 * client when the secret key is not configured.
 */
export async function checkSlugAvailability(
  slug: string,
  excludeStoreId?: string,
): Promise<Result<{ available: boolean }>> {
  if (!isValidSlug(slug)) return { ok: false, error: 'Dirección web inválida.' }
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: SESSION_EXPIRED }

  let client: Awaited<ReturnType<typeof createClient>>
  try {
    client = createAdminClient() as unknown as typeof client
  } catch {
    client = await createClient()
  }

  let query = client.from('stores').select('id').eq('slug', slug).limit(1)
  if (excludeStoreId && isUuid(excludeStoreId)) {
    query = query.neq('id', excludeStoreId)
  }
  const { data, error } = await query
  if (error) {
    console.error('Failed to check slug availability', error)
    return { ok: false, error: 'No pudimos verificar la dirección web.' }
  }
  return { ok: true, available: (data ?? []).length === 0 }
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createStore(
  input: CreateStoreInput,
): Promise<Result<{ storeId: string; slug: string }>> {
  const parsed = createStoreSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? 'Revisa los datos de la tienda.',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: SESSION_EXPIRED }

  // status and commission_pct are intentionally omitted: the
  // protect_store_admin_columns trigger rejects them for non-admins.
  const { data, error } = await supabase
    .from('stores')
    .insert({ ...parsed.data, owner_id: user.id })
    .select('id, slug')
    .single()

  if (error || !data) {
    console.error('Failed to create store', error)
    return {
      ok: false,
      error:
        error?.code === UNIQUE_VIOLATION
          ? SLUG_TAKEN
          : 'No pudimos crear la tienda. Inténtalo de nuevo.',
    }
  }

  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_STORE_COOKIE, data.id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ONE_YEAR_SECONDS,
  })
  revalidateStorePages()
  return { ok: true, storeId: data.id, slug: data.slug }
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateStore(
  storeId: string,
  input: StoreSettingsInput,
): Promise<Result> {
  if (!isUuid(storeId)) return { ok: false, error: 'Tienda inválida.' }
  const parsed = storeSettingsSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? 'Revisa los datos de la tienda.',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: SESSION_EXPIRED }

  const { data, error } = await supabase
    .from('stores')
    .update(parsed.data)
    .eq('id', storeId)
    .eq('owner_id', user.id)
    .select('slug')
  if (error) {
    console.error('Failed to update store', error)
    return {
      ok: false,
      error:
        error.code === UNIQUE_VIOLATION
          ? SLUG_TAKEN
          : 'No pudimos guardar los cambios. Inténtalo de nuevo.',
    }
  }
  if (!data || data.length === 0) {
    return { ok: false, error: 'No encontramos la tienda.' }
  }
  revalidateStorePages(data[0].slug)
  return { ok: true }
}

export async function setStoreOpen(
  storeId: string,
  isOpen: boolean,
): Promise<Result> {
  if (!isUuid(storeId)) return { ok: false, error: 'Tienda inválida.' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: SESSION_EXPIRED }

  const { data, error } = await supabase
    .from('stores')
    .update({ is_open: isOpen })
    .eq('id', storeId)
    .eq('owner_id', user.id)
    .select('slug')
  if (error || !data || data.length === 0) {
    console.error('Failed to toggle store', error)
    return { ok: false, error: 'No pudimos cambiar el estado de la tienda.' }
  }
  revalidateStorePages(data[0].slug)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

function isAssetKind(value: unknown): value is StoreAssetKind {
  return (
    typeof value === 'string' &&
    (STORE_ASSET_KINDS as readonly string[]).includes(value)
  )
}

/** Uploads a logo or cover to `store-assets/${storeId}/…` and links it. */
export async function uploadStoreAsset(
  formData: FormData,
): Promise<Result<{ url: string }>> {
  const storeId = formData.get('storeId')
  const kind = formData.get('kind')
  const file = formData.get('file')

  if (typeof storeId !== 'string' || !isUuid(storeId))
    return { ok: false, error: 'Tienda inválida.' }
  if (!isAssetKind(kind))
    return { ok: false, error: 'Tipo de imagen inválido.' }
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: 'Selecciona una imagen.' }
  if (!ACCEPTED_ASSET_TYPES.includes(file.type))
    return { ok: false, error: 'Usa una imagen PNG, JPG o WebP.' }
  if (file.size > MAX_ASSET_BYTES)
    return { ok: false, error: 'La imagen no puede superar 3 MB.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: SESSION_EXPIRED }

  const { data: store } = await supabase
    .from('stores')
    .select('id, slug')
    .eq('id', storeId)
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!store) return { ok: false, error: 'No encontramos la tienda.' }

  const path = assetObjectPath(storeId, kind, file.type, Date.now())
  if (!path) return { ok: false, error: 'Usa una imagen PNG, JPG o WebP.' }

  const bucket = supabase.storage.from('store-assets')
  const { error: uploadError } = await bucket.upload(path, file, {
    contentType: file.type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (uploadError) {
    console.error('Failed to upload store asset', uploadError)
    return {
      ok: false,
      error: 'No pudimos subir la imagen. Inténtalo de nuevo.',
    }
  }

  const url = bucket.getPublicUrl(path).data.publicUrl
  const { error: updateError } = await supabase
    .from('stores')
    .update(kind === 'logo' ? { logo_url: url } : { cover_url: url })
    .eq('id', storeId)
    .eq('owner_id', user.id)
  if (updateError) {
    console.error('Failed to link store asset', updateError)
    return { ok: false, error: 'Subimos la imagen pero no pudimos guardarla.' }
  }

  revalidateStorePages(store.slug)
  return { ok: true, url }
}
