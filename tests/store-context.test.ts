// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}))

class Redirect extends Error {
  constructor(readonly to: string) {
    super(`redirect ${to}`)
  }
}
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Redirect(to)
  },
}))

let role = 'merchant'
vi.mock('@/lib/auth', () => ({
  requireRole: async () => ({ user: { id: 'user-1' }, role }),
}))

let storesAnswer: { data: unknown; error: unknown } = { data: [], error: null }
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: async () => storesAnswer,
      }
      return chain
    },
  }),
}))

async function landing(): Promise<string> {
  // `cache` memoises per request; a fresh module per case is a fresh request.
  vi.resetModules()
  const { requireActiveStore } = await import('@/lib/dashboard/store-context')
  try {
    await requireActiveStore()
    return 'dashboard'
  } catch (error) {
    if (error instanceof Redirect) return error.to
    throw error
  }
}

describe('requireActiveStore', () => {
  beforeEach(() => {
    storesAnswer = { data: [], error: null }
  })

  it('sends a merchant without stores to the onboarding wizard', async () => {
    role = 'merchant'
    expect(await landing()).toBe('/dashboard/onboarding')
  })

  // The wizard would have created a store under the admin's own name.
  it('sends an admin without stores to /admin', async () => {
    role = 'admin'
    expect(await landing()).toBe('/admin')
  })

  // As an empty list, a failed read sent a merchant who has stores to the
  // wizard, one click away from a duplicate store.
  it('throws when the stores cannot be read', async () => {
    role = 'merchant'
    storesAnswer = { data: null, error: { message: 'timeout' } }
    await expect(landing()).rejects.toThrow('Query failed: merchant stores')
  })

  it('opens the dashboard on the first store', async () => {
    role = 'merchant'
    storesAnswer = {
      data: [{ id: 'a7c1f0de-1111-4a2b-9c3d-123456789abc', name: 'A' }],
      error: null,
    }
    expect(await landing()).toBe('dashboard')
  })
})
