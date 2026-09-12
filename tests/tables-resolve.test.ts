import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveTableWithClient } from '@/lib/tables/resolve'
import type { Database } from '@/types/database'

const TOKEN = 'a'.repeat(24)
const STORE = { id: 'store-1', slug: 'la-esquina', status: 'active' }
const MATCH = { id: 'table-1', store_id: 'store-1', number: 7 }

interface FakeOptions {
  rpc?: { data: unknown[] | null; error: { message: string } | null }
  store?: Record<string, unknown> | null
}

/** Minimal anon client: records rpc/select calls and replays canned answers. */
function fakeClient(options: FakeOptions = {}) {
  const calls: { fn: string; args: Record<string, unknown> }[] = []
  const selects: { table: string; filters: [string, unknown][] }[] = []
  const rpcAnswer = options.rpc ?? { data: [MATCH], error: null }
  const store = options.store === undefined ? STORE : options.store

  const client = {
    async rpc(fn: string, args: Record<string, unknown>) {
      calls.push({ fn, args })
      return rpcAnswer
    },
    from(table: string) {
      const entry = { table, filters: [] as [string, unknown][] }
      selects.push(entry)
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          entry.filters.push([column, value])
          return chain
        },
        maybeSingle: async () => ({ data: store, error: null }),
      }
      return chain
    },
  }
  return { client: client as unknown as SupabaseClient<Database>, calls, selects }
}

describe('resolveTableWithClient', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects malformed tokens without touching the database', async () => {
    const { client, calls } = fakeClient()
    const result = await resolveTableWithClient(client, 'la-esquina', 'nope')
    expect(result).toBeNull()
    expect(calls).toEqual([])
  })

  it('resolves the table through the rpc and loads the active store by id', async () => {
    const { client, calls, selects } = fakeClient()
    const result = await resolveTableWithClient(client, 'la-esquina', TOKEN)
    expect(calls).toEqual([
      { fn: 'resolve_store_table', args: { store_slug: 'la-esquina', token: TOKEN } },
    ])
    expect(selects).toEqual([
      {
        table: 'stores',
        filters: [
          ['id', 'store-1'],
          ['status', 'active'],
        ],
      },
    ])
    expect(result).toEqual({
      store: STORE,
      table: { id: 'table-1', number: 7, token: TOKEN },
    })
  })

  it('returns null when no table matches the slug and token', async () => {
    const { client, selects } = fakeClient({ rpc: { data: [], error: null } })
    const result = await resolveTableWithClient(client, 'la-esquina', TOKEN)
    expect(result).toBeNull()
    expect(selects).toEqual([])
  })

  it('logs and returns null when the rpc fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client } = fakeClient({
      rpc: { data: null, error: { message: 'boom' } },
    })
    const result = await resolveTableWithClient(client, 'la-esquina', TOKEN)
    expect(result).toBeNull()
    expect(error).toHaveBeenCalledWith(
      'Failed to resolve table token',
      { message: 'boom' },
    )
  })

  it('returns null when the store is no longer readable after the match', async () => {
    const { client } = fakeClient({ store: null })
    const result = await resolveTableWithClient(client, 'la-esquina', TOKEN)
    expect(result).toBeNull()
  })
})
