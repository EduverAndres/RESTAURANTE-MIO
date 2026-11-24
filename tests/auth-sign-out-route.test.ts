// @vitest-environment node
import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/auth/sign-out/route'

const auth = vi.hoisted(() => ({ signOut: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/site-url', () => ({ siteUrl: () => 'https://tienda.app' }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth })),
}))

function post(): Promise<Response> {
  return POST(
    new NextRequest('https://tienda.app/auth/sign-out', {
      method: 'POST',
      headers: { host: 'tienda.app' },
    }),
  )
}

afterEach(() => {
  auth.signOut.mockReset()
})

describe('POST /auth/sign-out', () => {
  it('ends only this session, never the account on every device', async () => {
    auth.signOut.mockResolvedValue({ error: null })

    await post()

    // A global sign-out here signed the same account out of every other
    // browser: the customer's open tab fell to /login the moment a store
    // answered their reservation and the page refreshed.
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('lands on the home page with a GET and no caching', async () => {
    auth.signOut.mockResolvedValue({ error: null })

    const response = await post()

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('https://tienda.app/')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})
