import { describe, expect, it } from 'vitest'
import { fetchAllRows } from '@/lib/supabase/fetch-all'

/** A fake table of `total` rows served in slices, like PostgREST's range. */
function table(total: number, failAtFrom?: number) {
  const calls: [number, number][] = []
  const page = async (from: number, to: number) => {
    calls.push([from, to])
    if (from === failAtFrom) return { data: null, error: new Error('boom') }
    const data = Array.from(
      { length: Math.max(0, Math.min(to, total - 1) - from + 1) },
      (_, index) => from + index,
    )
    return { data, error: null }
  }
  return { page, calls }
}

describe('fetchAllRows', () => {
  it('reads past the 1000-row cap, page by page', async () => {
    const { page, calls } = table(2500)
    const result = await fetchAllRows(page)
    expect(result.data).toHaveLength(2500)
    expect(result.data.at(-1)).toBe(2499)
    expect(result.truncated).toBe(false)
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ])
  })

  it('stops after one request when the first page is short', async () => {
    const { page, calls } = table(3)
    expect((await fetchAllRows(page)).data).toEqual([0, 1, 2])
    expect(calls).toHaveLength(1)
  })

  it('asks for one more page when the last one is exactly full', async () => {
    const { page, calls } = table(1000)
    expect((await fetchAllRows(page)).data).toHaveLength(1000)
    expect(calls).toHaveLength(2)
  })

  it('stops at maxRows and says so', async () => {
    const { page } = table(10, undefined)
    const result = await fetchAllRows(page, { pageSize: 3, maxRows: 7 })
    expect(result.data).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(result.truncated).toBe(true)
  })

  it('returns the rows read before an error, with the error', async () => {
    const { page } = table(2500, 1000)
    const result = await fetchAllRows(page)
    expect(result.data).toHaveLength(1000)
    expect(result.error).toBeInstanceOf(Error)
  })
})
