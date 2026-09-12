'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { isUuid } from '@/lib/dashboard/active-store'
import { requireActiveStore } from '@/lib/dashboard/store-context'
import { createClient } from '@/lib/supabase/server'
import { nextTableNumber, parseTableNumbers } from '@/lib/tables/qr'

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

const INVALID_TABLE = 'Mesa inválida.'
const NOT_FOUND = 'No encontramos la mesa.'
const DUPLICATE_NUMBER =
  'Ese número de mesa ya existe. Actualiza la página e inténtalo de nuevo.'
/** PostgreSQL unique_violation: the (store_id, number) pair already exists. */
const UNIQUE_VIOLATION = '23505'

/**
 * Every write is scoped to the merchant's active store: the store comes
 * from the dashboard context (never from the client) and RLS additionally
 * checks ownership through owns_store.
 */
async function activeStoreScope() {
  const { active } = await requireActiveStore('/dashboard/tables')
  const supabase = await createClient()
  return { supabase, storeId: active.id }
}

function revalidateTables() {
  revalidatePath('/dashboard/tables')
  revalidatePath('/dashboard/tables/print')
}

async function existingNumbers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storeId: string,
): Promise<number[]> {
  const { data } = await supabase
    .from('store_tables')
    .select('number')
    .eq('store_id', storeId)
  return (data ?? []).map((row) => row.number)
}

export async function createTable(): Promise<Result<{ number: number }>> {
  const { supabase, storeId } = await activeStoreScope()
  const number = nextTableNumber(await existingNumbers(supabase, storeId))
  const { error } = await supabase
    .from('store_tables')
    .insert({ store_id: storeId, number })
  if (error) {
    console.error('Failed to create table', error)
    return {
      ok: false,
      error:
        error.code === UNIQUE_VIOLATION
          ? DUPLICATE_NUMBER
          : 'No pudimos crear la mesa. Inténtalo de nuevo.',
    }
  }
  revalidateTables()
  return { ok: true, number }
}

export async function createTablesFromRange(
  input: string,
): Promise<Result<{ created: number; skipped: number }>> {
  const numbers = parseTableNumbers(String(input ?? ''))
  if (numbers.length === 0)
    return {
      ok: false,
      error: 'Usa un rango como 1-12 o una lista como 1,2,5 (máximo 200).',
    }
  const { supabase, storeId } = await activeStoreScope()
  const existing = new Set(await existingNumbers(supabase, storeId))
  const missing = numbers.filter((number) => !existing.has(number))
  if (missing.length > 0) {
    const { error } = await supabase
      .from('store_tables')
      .insert(missing.map((number) => ({ store_id: storeId, number })))
    if (error) {
      console.error('Failed to create tables', error)
      return {
        ok: false,
        error:
          error.code === UNIQUE_VIOLATION
            ? DUPLICATE_NUMBER
            : 'No pudimos crear las mesas. Inténtalo de nuevo.',
      }
    }
  }
  revalidateTables()
  return {
    ok: true,
    created: missing.length,
    skipped: numbers.length - missing.length,
  }
}

export async function deleteTable(tableId: string): Promise<Result> {
  if (!isUuid(tableId)) return { ok: false, error: INVALID_TABLE }
  const { supabase, storeId } = await activeStoreScope()
  const { data, error } = await supabase
    .from('store_tables')
    .delete()
    .eq('id', tableId)
    .eq('store_id', storeId)
    .select('id')
  if (error || !data || data.length === 0) {
    console.error('Failed to delete table', error)
    return { ok: false, error: error ? 'No pudimos eliminar la mesa.' : NOT_FOUND }
  }
  revalidateTables()
  return { ok: true }
}

/**
 * Replaces the QR token so printed codes stop working. PostgREST cannot
 * reset a column to its default, so the 24-hex token is generated here.
 */
export async function regenerateTableToken(tableId: string): Promise<Result> {
  if (!isUuid(tableId)) return { ok: false, error: INVALID_TABLE }
  const { supabase, storeId } = await activeStoreScope()
  const { data, error } = await supabase
    .from('store_tables')
    .update({ qr_token: randomBytes(12).toString('hex') })
    .eq('id', tableId)
    .eq('store_id', storeId)
    .select('id')
  if (error || !data || data.length === 0) {
    console.error('Failed to regenerate table token', error)
    return { ok: false, error: error ? 'No pudimos renovar el código QR.' : NOT_FOUND }
  }
  revalidateTables()
  return { ok: true }
}
