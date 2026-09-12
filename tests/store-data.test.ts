import { beforeEach, describe, expect, it, vi } from 'vitest'

const maybeSingle = vi.fn()

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle }),
        }),
      }),
    }),
  }),
}))

const { fetchStore } = await import('@/lib/store/data')

const STORE = { id: 'abc', slug: 'verde-bowl', name: 'Verde Bowl' }

describe('fetchStore', () => {
  beforeEach(() => {
    maybeSingle.mockReset()
  })

  it('returns the store when the row exists', async () => {
    maybeSingle.mockResolvedValue({ data: STORE, error: null })
    await expect(fetchStore('verde-bowl')).resolves.toMatchObject({
      slug: 'verde-bowl',
    })
  })

  it('returns null when the slug genuinely has no row', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(fetchStore('does-not-exist')).resolves.toBeNull()
  })

  it('throws when the query fails, so the page does not claim the store is missing', async () => {
    maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'fetch failed', code: '08006' },
    })
    // Returning null here would render "no existe" for a transient network
    // blip; throwing lets the route's error boundary offer a retry instead.
    await expect(fetchStore('verde-bowl')).rejects.toThrow(/verde-bowl/)
  })
})
