'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { isUuid } from '@/lib/dashboard/active-store'
import type { PositionUpdate } from '@/lib/menu/reorder'
import { createClient } from '@/lib/supabase/server'
import type { ProductWithOptions } from '@/types/app'
import {
  ACCEPTED_PRODUCT_IMAGE_TYPES,
  MAX_PRODUCT_IMAGE_BYTES,
  categorySchema,
  optionGroupsSchema,
  productImageObjectPath,
  productSchema,
  type CategoryInput,
  type OptionGroupInput,
  type ProductInput,
} from '@/lib/validations/menu'

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

const SESSION_EXPIRED = 'Tu sesión expiró. Inicia sesión de nuevo.'
const INVALID_STORE = 'Tienda inválida.'
const STORE_NOT_FOUND = 'No encontramos la tienda.'
const GENERIC_ERROR = 'No pudimos guardar los cambios. Inténtalo de nuevo.'

type Supabase = Awaited<ReturnType<typeof createClient>>

interface OwnedStore {
  supabase: Supabase
  slug: string
}

/**
 * Re-authenticates and verifies the store belongs to the caller. Every write
 * below is additionally scoped by store_id so RLS and this check agree.
 */
async function requireOwnedStore(storeId: string): Promise<Result<OwnedStore>> {
  if (!isUuid(storeId)) return { ok: false, error: INVALID_STORE }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: SESSION_EXPIRED }

  const { data: store } = await supabase
    .from('stores')
    .select('slug')
    .eq('id', storeId)
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!store) return { ok: false, error: STORE_NOT_FOUND }
  return { ok: true, supabase, slug: store.slug }
}

function revalidateMenu(slug: string) {
  revalidatePath('/dashboard/menu')
  revalidatePath(`/t/${slug}`)
}

function firstIssue(
  error: { issues: { message: string }[] },
  fallback: string,
) {
  return error.issues[0]?.message ?? fallback
}

function validUpdates(updates: PositionUpdate[]): boolean {
  return (
    updates.length <= 200 &&
    updates.every(
      (update) =>
        isUuid(update.id) &&
        Number.isInteger(update.position) &&
        update.position >= 0,
    )
  )
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function createCategory(
  storeId: string,
  input: CategoryInput,
): Promise<Result<{ id: string }>> {
  const parsed = categorySchema.safeParse(input)
  if (!parsed.success)
    return { ok: false, error: firstIssue(parsed.error, GENERIC_ERROR) }
  const owned = await requireOwnedStore(storeId)
  if (!owned.ok) return owned

  const { count } = await owned.supabase
    .from('menu_categories')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)

  const { data, error } = await owned.supabase
    .from('menu_categories')
    .insert({ store_id: storeId, name: parsed.data.name, position: count ?? 0 })
    .select('id')
    .single()
  if (error || !data) {
    console.error('Failed to create category', error)
    return { ok: false, error: 'No pudimos crear la categoría.' }
  }
  revalidateMenu(owned.slug)
  return { ok: true, id: data.id }
}

export async function renameCategory(
  storeId: string,
  categoryId: string,
  input: CategoryInput,
): Promise<Result> {
  if (!isUuid(categoryId)) return { ok: false, error: 'Categoría inválida.' }
  const parsed = categorySchema.safeParse(input)
  if (!parsed.success)
    return { ok: false, error: firstIssue(parsed.error, GENERIC_ERROR) }
  const owned = await requireOwnedStore(storeId)
  if (!owned.ok) return owned

  const { data, error } = await owned.supabase
    .from('menu_categories')
    .update({ name: parsed.data.name })
    .eq('id', categoryId)
    .eq('store_id', storeId)
    .select('id')
  if (error || !data || data.length === 0) {
    console.error('Failed to rename category', error)
    return { ok: false, error: 'No pudimos renombrar la categoría.' }
  }
  revalidateMenu(owned.slug)
  return { ok: true }
}

export async function setCategoryVisibility(
  storeId: string,
  categoryId: string,
  isVisible: boolean,
): Promise<Result> {
  if (!isUuid(categoryId)) return { ok: false, error: 'Categoría inválida.' }
  const owned = await requireOwnedStore(storeId)
  if (!owned.ok) return owned

  const { data, error } = await owned.supabase
    .from('menu_categories')
    .update({ is_visible: isVisible })
    .eq('id', categoryId)
    .eq('store_id', storeId)
    .select('id')
  if (error || !data || data.length === 0) {
    console.error('Failed to toggle category', error)
    return { ok: false, error: 'No pudimos cambiar la visibilidad.' }
  }
  revalidateMenu(owned.slug)
  return { ok: true }
}

export async function reorderCategories(
  storeId: string,
  updates: PositionUpdate[],
): Promise<Result> {
  if (!validUpdates(updates)) return { ok: false, error: 'Orden inválido.' }
  const owned = await requireOwnedStore(storeId)
  if (!owned.ok) return owned

  // One update per row: a single upsert would need the NOT NULL `name`
  // column, which PositionUpdate does not carry.
  for (const update of updates) {
    const { error } = await owned.supabase
      .from('menu_categories')
      .update({ position: update.position })
      .eq('id', update.id)
      .eq('store_id', storeId)
    if (error) {
      console.error('Failed to reorder categories', error)
      return { ok: false, error: 'No pudimos reordenar las categorías.' }
    }
  }
  revalidateMenu(owned.slug)
  return { ok: true }
}

/** Products of the category keep existing without category (FK set null). */
export async function deleteCategory(
  storeId: string,
  categoryId: string,
): Promise<Result> {
  if (!isUuid(categoryId)) return { ok: false, error: 'Categoría inválida.' }
  const owned = await requireOwnedStore(storeId)
  if (!owned.ok) return owned

  const { data, error } = await owned.supabase
    .from('menu_categories')
    .delete()
    .eq('id', categoryId)
    .eq('store_id', storeId)
    .select('id')
  if (error || !data || data.length === 0) {
    console.error('Failed to delete category', error)
    return { ok: false, error: 'No pudimos eliminar la categoría.' }
  }
  revalidateMenu(owned.slug)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

async function categoryBelongsToStore(
  supabase: Supabase,
  storeId: string,
  categoryId: string | null,
): Promise<boolean> {
  if (categoryId === null) return true
  const { data } = await supabase
    .from('menu_categories')
    .select('id')
    .eq('id', categoryId)
    .eq('store_id', storeId)
    .maybeSingle()
  return Boolean(data)
}

/**
 * Returns the created row (with an empty option list) so the client can switch
 * the sheet into edit mode right away and a resubmit updates instead of
 * creating a duplicate.
 */
export async function createProduct(
  storeId: string,
  input: ProductInput,
): Promise<Result<{ id: string; product: ProductWithOptions }>> {
  const parsed = productSchema.safeParse(input)
  if (!parsed.success)
    return { ok: false, error: firstIssue(parsed.error, GENERIC_ERROR) }
  const owned = await requireOwnedStore(storeId)
  if (!owned.ok) return owned
  const { supabase } = owned

  if (
    !(await categoryBelongsToStore(supabase, storeId, parsed.data.category_id))
  )
    return { ok: false, error: 'La categoría no pertenece a esta tienda.' }

  let countQuery = supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)
  countQuery =
    parsed.data.category_id === null
      ? countQuery.is('category_id', null)
      : countQuery.eq('category_id', parsed.data.category_id)
  const { count } = await countQuery

  const { data, error } = await supabase
    .from('products')
    .insert({ ...parsed.data, store_id: storeId, position: count ?? 0 })
    .select('*')
    .single()
  if (error || !data) {
    console.error('Failed to create product', error)
    return { ok: false, error: 'No pudimos crear el producto.' }
  }
  revalidateMenu(owned.slug)
  return { ok: true, id: data.id, product: { ...data, product_options: [] } }
}

export async function updateProduct(
  storeId: string,
  productId: string,
  input: ProductInput,
): Promise<Result> {
  if (!isUuid(productId)) return { ok: false, error: 'Producto inválido.' }
  const parsed = productSchema.safeParse(input)
  if (!parsed.success)
    return { ok: false, error: firstIssue(parsed.error, GENERIC_ERROR) }
  const owned = await requireOwnedStore(storeId)
  if (!owned.ok) return owned
  const { supabase } = owned

  if (
    !(await categoryBelongsToStore(supabase, storeId, parsed.data.category_id))
  )
    return { ok: false, error: 'La categoría no pertenece a esta tienda.' }

  const { data, error } = await supabase
    .from('products')
    .update(parsed.data)
    .eq('id', productId)
    .eq('store_id', storeId)
    .select('id')
  if (error || !data || data.length === 0) {
    console.error('Failed to update product', error)
    return { ok: false, error: 'No pudimos guardar el producto.' }
  }
  revalidateMenu(owned.slug)
  return { ok: true }
}

export async function setProductAvailability(
  storeId: string,
  productId: string,
  isAvailable: boolean,
): Promise<Result> {
  if (!isUuid(productId)) return { ok: false, error: 'Producto inválido.' }
  const owned = await requireOwnedStore(storeId)
  if (!owned.ok) return owned

  const { data, error } = await owned.supabase
    .from('products')
    .update({ is_available: isAvailable })
    .eq('id', productId)
    .eq('store_id', storeId)
    .select('id')
  if (error || !data || data.length === 0) {
    console.error('Failed to toggle product', error)
    return { ok: false, error: 'No pudimos cambiar la disponibilidad.' }
  }
  revalidateMenu(owned.slug)
  return { ok: true }
}

export async function reorderProducts(
  storeId: string,
  updates: PositionUpdate[],
): Promise<Result> {
  if (!validUpdates(updates)) return { ok: false, error: 'Orden inválido.' }
  const owned = await requireOwnedStore(storeId)
  if (!owned.ok) return owned

  // One update per row: a single upsert would need the NOT NULL `name` and
  // `price` columns, which PositionUpdate does not carry.
  for (const update of updates) {
    const { error } = await owned.supabase
      .from('products')
      .update({ position: update.position })
      .eq('id', update.id)
      .eq('store_id', storeId)
    if (error) {
      console.error('Failed to reorder products', error)
      return { ok: false, error: 'No pudimos reordenar los productos.' }
    }
  }
  revalidateMenu(owned.slug)
  return { ok: true }
}

export async function deleteProduct(
  storeId: string,
  productId: string,
): Promise<Result> {
  if (!isUuid(productId)) return { ok: false, error: 'Producto inválido.' }
  const owned = await requireOwnedStore(storeId)
  if (!owned.ok) return owned

  const { data, error } = await owned.supabase
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('store_id', storeId)
    .select('id')
  if (error || !data || data.length === 0) {
    console.error('Failed to delete product', error)
    return { ok: false, error: 'No pudimos eliminar el producto.' }
  }
  revalidateMenu(owned.slug)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Product image (bucket product-images, keyed `${storeId}/…`)
// ---------------------------------------------------------------------------

export async function uploadProductImage(
  formData: FormData,
): Promise<Result<{ url: string }>> {
  const storeId = formData.get('storeId')
  const productId = formData.get('productId')
  const file = formData.get('file')

  if (typeof storeId !== 'string' || !isUuid(storeId))
    return { ok: false, error: INVALID_STORE }
  if (typeof productId !== 'string' || !isUuid(productId))
    return { ok: false, error: 'Producto inválido.' }
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: 'Selecciona una imagen.' }
  if (!ACCEPTED_PRODUCT_IMAGE_TYPES.includes(file.type))
    return { ok: false, error: 'Usa una imagen PNG, JPG o WebP.' }
  if (file.size > MAX_PRODUCT_IMAGE_BYTES)
    return { ok: false, error: 'La imagen no puede superar 3 MB.' }

  const owned = await requireOwnedStore(storeId)
  if (!owned.ok) return owned
  const { supabase } = owned

  const path = productImageObjectPath(storeId, file.type, Date.now())
  if (!path) return { ok: false, error: 'Usa una imagen PNG, JPG o WebP.' }

  const bucket = supabase.storage.from('product-images')
  const { error: uploadError } = await bucket.upload(path, file, {
    contentType: file.type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (uploadError) {
    console.error('Failed to upload product image', uploadError)
    return {
      ok: false,
      error: 'No pudimos subir la imagen. Inténtalo de nuevo.',
    }
  }

  const url = bucket.getPublicUrl(path).data.publicUrl
  const { data, error } = await supabase
    .from('products')
    .update({ image_url: url })
    .eq('id', productId)
    .eq('store_id', storeId)
    .select('id')
  if (error || !data || data.length === 0) {
    console.error('Failed to link product image', error)
    return { ok: false, error: 'Subimos la imagen pero no pudimos guardarla.' }
  }
  revalidateMenu(owned.slug)
  return { ok: true, url }
}

// ---------------------------------------------------------------------------
// Option groups
// ---------------------------------------------------------------------------

/**
 * Replaces the option groups of a product with the submitted list. Ids are
 * kept when they already belong to the product (so edits stay in place);
 * unknown ids are treated as new rows and rows left out are deleted.
 *
 * Ordering matters because there is no transaction: kept/new groups and values
 * are upserted FIRST and removed rows are deleted LAST. A failure mid-way then
 * leaves a superset of what the merchant submitted (old rows still present)
 * instead of losing data; the next successful save converges.
 */
export async function saveProductOptions(
  storeId: string,
  productId: string,
  input: OptionGroupInput[],
): Promise<Result> {
  if (!isUuid(productId)) return { ok: false, error: 'Producto inválido.' }
  const parsed = optionGroupsSchema.safeParse(input)
  if (!parsed.success)
    return { ok: false, error: firstIssue(parsed.error, GENERIC_ERROR) }
  const owned = await requireOwnedStore(storeId)
  if (!owned.ok) return owned
  const { supabase } = owned

  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('id', productId)
    .eq('store_id', storeId)
    .maybeSingle()
  if (!product) return { ok: false, error: 'No encontramos el producto.' }

  const { data: existingGroups } = await supabase
    .from('product_options')
    .select('id')
    .eq('product_id', productId)
  const knownGroupIds = new Set((existingGroups ?? []).map((row) => row.id))

  const { data: existingValues } = knownGroupIds.size
    ? await supabase
        .from('product_option_values')
        .select('id')
        .in('option_id', [...knownGroupIds])
    : { data: [] as { id: string }[] }
  const knownValueIds = new Set((existingValues ?? []).map((row) => row.id))

  const groupRows = parsed.data.map((group, position) => ({
    id: group.id && knownGroupIds.has(group.id) ? group.id : randomUUID(),
    product_id: productId,
    name: group.name,
    required: group.required,
    min: group.min,
    max: group.max,
    position,
  }))
  const valueRows = parsed.data.flatMap((group, groupIndex) =>
    group.values.map((value, position) => ({
      id: value.id && knownValueIds.has(value.id) ? value.id : randomUUID(),
      option_id: groupRows[groupIndex].id,
      name: value.name,
      price_delta: value.price_delta,
      position,
    })),
  )

  // 1. Upsert groups (values reference them) and then their values.
  if (groupRows.length > 0) {
    const { error } = await supabase.from('product_options').upsert(groupRows)
    if (error) {
      console.error('Failed to upsert option groups', error)
      return { ok: false, error: 'No pudimos guardar las opciones.' }
    }
  }

  if (valueRows.length > 0) {
    const { error } = await supabase
      .from('product_option_values')
      .upsert(valueRows)
    if (error) {
      console.error('Failed to upsert option values', error)
      return { ok: false, error: 'No pudimos guardar las opciones.' }
    }
  }

  // 2. Only now remove what was left out: values first, then whole groups.
  const keptValueIds = new Set(valueRows.map((row) => row.id))
  const removedValueIds = [...knownValueIds].filter(
    (id) => !keptValueIds.has(id),
  )
  if (removedValueIds.length > 0) {
    const { error } = await supabase
      .from('product_option_values')
      .delete()
      .in('id', removedValueIds)
    if (error) {
      console.error('Failed to delete option values', error)
      return { ok: false, error: 'No pudimos guardar las opciones.' }
    }
  }

  const keptGroupIds = new Set(groupRows.map((row) => row.id))
  const removedGroupIds = [...knownGroupIds].filter(
    (id) => !keptGroupIds.has(id),
  )
  if (removedGroupIds.length > 0) {
    const { error } = await supabase
      .from('product_options')
      .delete()
      .in('id', removedGroupIds)
    if (error) {
      console.error('Failed to delete option groups', error)
      return { ok: false, error: 'No pudimos guardar las opciones.' }
    }
  }

  revalidateMenu(owned.slug)
  return { ok: true }
}
