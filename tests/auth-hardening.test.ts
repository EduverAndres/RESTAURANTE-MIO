import { describe, expect, it, vi } from 'vitest'
import { AUTH_ERROR_MESSAGES, mapAuthError } from '@/lib/auth/errors'
import { authRateLimitChecks, checkAuthRateLimit } from '@/lib/rate-limit/auth'
import {
  AUTH_EMAIL_ACCOUNT_POLICY,
  AUTH_EMAIL_IP_POLICY,
  AUTH_LOGIN_ACCOUNT_POLICY,
  AUTH_LOGIN_IP_POLICY,
  AUTH_SIGNUP_IP_POLICY,
} from '@/lib/rate-limit/policy'
import type { RateLimitStore } from '@/lib/rate-limit/store'
import { registerSchema } from '@/lib/validations/auth'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

const EMAIL = 'ana@correo.co'
const IP = '203.0.113.7'

describe('authRateLimitChecks', () => {
  it('budgets login per account and per address', () => {
    const checks = authRateLimitChecks('login', { email: EMAIL, ip: IP })
    expect(checks.map((check) => check.policy)).toEqual([
      AUTH_LOGIN_ACCOUNT_POLICY,
      AUTH_LOGIN_IP_POLICY,
    ])
  })

  it('budgets emails per account and per address', () => {
    const checks = authRateLimitChecks('email', { email: EMAIL, ip: IP })
    expect(checks.map((check) => check.policy)).toEqual([
      AUTH_EMAIL_ACCOUNT_POLICY,
      AUTH_EMAIL_IP_POLICY,
    ])
  })

  it('budgets sign-ups per address only', () => {
    const checks = authRateLimitChecks('signup', { email: EMAIL, ip: IP })
    expect(checks.map((check) => check.policy)).toEqual([AUTH_SIGNUP_IP_POLICY])
  })

  it('never stores the email or the address verbatim', () => {
    const checks = authRateLimitChecks('login', { email: EMAIL, ip: IP })
    for (const check of checks) {
      expect(check.identifier).not.toContain(EMAIL)
      expect(check.identifier).not.toContain(IP)
      expect(check.identifier).toMatch(/^[0-9a-f]{32}$/)
    }
  })

  it('skips the address budget when there is no proxy header', () => {
    const checks = authRateLimitChecks('login', { email: EMAIL, ip: null })
    expect(checks.map((check) => check.policy)).toEqual([
      AUTH_LOGIN_ACCOUNT_POLICY,
    ])
  })
})

describe('checkAuthRateLimit', () => {
  function storeReturning(count: number): RateLimitStore {
    return {
      consume: vi.fn(async () => ({ count, windowStart: new Date() })),
    }
  }

  it('allows up to the account limit and denies the next attempt', async () => {
    const limit = AUTH_LOGIN_ACCOUNT_POLICY.limit
    const atLimit = await checkAuthRateLimit(
      'login',
      { email: EMAIL, ip: null },
      storeReturning(limit),
    )
    expect(atLimit.allowed).toBe(true)

    const over = await checkAuthRateLimit(
      'login',
      { email: EMAIL, ip: null },
      storeReturning(limit + 1),
    )
    expect(over.allowed).toBe(false)
    expect(over.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('fails open when the counter store is unavailable', async () => {
    const broken: RateLimitStore = {
      consume: vi.fn(async () => {
        throw new Error('db down')
      }),
    }
    const decision = await checkAuthRateLimit(
      'login',
      { email: EMAIL, ip: IP },
      broken,
    )
    expect(decision.allowed).toBe(true)
  })
})

describe('registerSchema password confirmation', () => {
  const base = {
    full_name: 'Ana Pérez',
    email: EMAIL,
    password: 'secreto123',
    role: 'customer' as const,
    accept_terms: true,
  }

  it('accepts matching passwords', () => {
    expect(
      registerSchema.safeParse({ ...base, confirm_password: 'secreto123' })
        .success,
    ).toBe(true)
  })

  it('rejects a confirmation that differs, on the confirmation field', () => {
    const result = registerSchema.safeParse({
      ...base,
      confirm_password: 'secreto124',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['confirm_password'])
  })

  it('rejects a missing confirmation', () => {
    expect(registerSchema.safeParse(base).success).toBe(false)
  })
})

describe('mapAuthError', () => {
  it('explains a reused password instead of a generic error', () => {
    expect(mapAuthError({ code: 'same_password' })).toBe(
      AUTH_ERROR_MESSAGES.samePassword,
    )
  })
})
