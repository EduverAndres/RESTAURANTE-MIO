import { describe, expect, it } from 'vitest'
import { throwOnQueryError } from '@/lib/supabase/query-error'

// The merchant's board read "no orders" when its query failed: a failed read
// must reach the panel's error screen, never pass for an empty list.
describe('throwOnQueryError', () => {
  it('does nothing when the query succeeded', () => {
    expect(() => throwOnQueryError(null, 'board')).not.toThrow()
  })

  it('throws with the cause attached when it failed', () => {
    const cause = { code: '42P01', message: 'relation does not exist' }
    try {
      throwOnQueryError(cause, 'merchant order board')
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe(
        'Query failed: merchant order board',
      )
      expect((error as Error).cause).toBe(cause)
    }
  })
})
