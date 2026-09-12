// @vitest-environment node
import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/auth/callback/route'
import { resolveUserRole } from '@/lib/auth/resolve-role'
import { createClient } from '@/lib/supabase/server'

const auth = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://tienda.app' },
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth })),
}))
vi.mock('@/lib/auth/resolve-role', () => ({ resolveUserRole: vi.fn() }))

const resolveRole = vi.mocked(resolveUserRole)
const session = {
  user: { id: 'user-1', app_metadata: {} },
}

function get(query: string, host = 'localhost:3000'): Promise<Response> {
  return GET(
    new NextRequest(`http://${host}/auth/callback${query}`, {
      headers: { host },
    }),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  auth.verifyOtp.mockReset()
  auth.exchangeCodeForSession.mockReset()
  resolveRole.mockReset()
  vi.mocked(createClient).mockClear()
})

describe('GET /auth/callback', () => {
  it('verifies a token_hash link and lands a merchant on the dashboard', async () => {
    auth.verifyOtp.mockResolvedValue({ data: { session }, error: null })
    resolveRole.mockResolvedValue('merchant')

    const response = await get('?token_hash=abc123&type=signup')

    expect(auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: 'abc123',
      type: 'signup',
    })
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled()
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/dashboard',
    )
  })

  it('exchanges a PKCE code and honours a sanitised next', async () => {
    auth.exchangeCodeForSession.mockResolvedValue({
      data: { session },
      error: null,
    })

    const response = await get('?code=xyz&next=%2Forders%2F1%3Ftab%3D2')

    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('xyz')
    expect(resolveRole).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/orders/1?tab=2',
    )
  })

  it('ignores an off-origin next and uses the role home instead', async () => {
    auth.exchangeCodeForSession.mockResolvedValue({
      data: { session },
      error: null,
    })
    resolveRole.mockResolvedValue('courier')

    const response = await get('?code=xyz&next=https%3A%2F%2Fevil.com')

    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/courier',
    )
  })

  it('redirects to /login?error=expired when the token expired', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    auth.verifyOtp.mockResolvedValue({
      data: { session: null },
      error: { code: 'otp_expired', message: 'Token has expired' },
    })

    const response = await get('?token_hash=abc123&type=recovery')

    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login?error=expired',
    )
  })

  it('redirects to /login?error=missing without calling Supabase', async () => {
    const response = await get('')

    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login?error=missing',
    )
    expect(createClient).not.toHaveBeenCalled()
  })

  it('surfaces GoTrue query errors without calling Supabase', async () => {
    const response = await get('?error=access_denied&error_code=otp_expired')

    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login?error=expired',
    )
    expect(createClient).not.toHaveBeenCalled()
  })

  it('never redirects to the 0.0.0.0 bind address', async () => {
    auth.verifyOtp.mockResolvedValue({ data: { session }, error: null })
    resolveRole.mockResolvedValue('customer')

    const response = await get('?token_hash=abc&type=magiclink', '0.0.0.0:3000')

    expect(response.headers.get('location')).toBe('http://localhost:3000/')
  })

  it('falls back to the site url for a spoofed host header', async () => {
    const response = await get('', 'evil.com')

    expect(response.headers.get('location')).toBe(
      'https://tienda.app/login?error=missing',
    )
  })
})
