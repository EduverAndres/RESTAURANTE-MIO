import type { SupabaseClient, User } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveUserRole } from '@/lib/auth/resolve-role'
import type { Database } from '@/types/database'

function userWith(role?: unknown): User {
  return {
    id: 'user-1',
    app_metadata: role === undefined ? {} : { role },
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-09-12T00:00:00.000Z',
  }
}

type ProfileResult = {
  data: { role: string } | null
  error: { code: string; message: string } | null
}

function clientReturning(result: ProfileResult) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ select })
  return {
    client: { from } as unknown as SupabaseClient<Database>,
    from,
    eq,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('resolveUserRole', () => {
  it('uses the app_metadata claim without touching the database', async () => {
    const { client, from } = clientReturning({ data: null, error: null })
    await expect(resolveUserRole(client, userWith('merchant'))).resolves.toBe(
      'merchant',
    )
    expect(from).not.toHaveBeenCalled()
  })

  it('falls back to the profile row when the claim is missing or unknown', async () => {
    const { client, from, eq } = clientReturning({
      data: { role: 'courier' },
      error: null,
    })
    await expect(resolveUserRole(client, userWith())).resolves.toBe('courier')
    expect(from).toHaveBeenCalledWith('profiles')
    expect(eq).toHaveBeenCalledWith('id', 'user-1')

    const unknown = clientReturning({ data: { role: 'admin' }, error: null })
    await expect(
      resolveUserRole(unknown.client, userWith('superuser')),
    ).resolves.toBe('admin')
  })

  it('defaults to customer when there is no profile row', async () => {
    const { client } = clientReturning({ data: null, error: null })
    await expect(resolveUserRole(client, userWith())).resolves.toBe('customer')
  })

  it('logs and defaults to customer when the profile lookup fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client } = clientReturning({
      data: null,
      error: { code: '57P01', message: 'terminating connection' },
    })
    await expect(resolveUserRole(client, userWith())).resolves.toBe('customer')
    expect(error).toHaveBeenCalledWith(
      '[auth] profiles role lookup failed',
      expect.objectContaining({
        userId: 'user-1',
        code: '57P01',
        message: 'terminating connection',
      }),
    )
  })
})
