import { describe, expect, it } from 'vitest'
import {
  parseServerEnv,
  pushConfiguredFrom,
  sentryConfiguredFrom,
  wompiConfiguredFrom,
} from '@/lib/env.server-schema'

const DSN = 'https://abc123@o4507.ingest.sentry.io/4508'

describe('parseServerEnv', () => {
  it('accepts an empty environment: every server secret is optional', () => {
    const parsed = parseServerEnv({})
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.WOMPI_PUBLIC_KEY).toBeUndefined()
    expect(parsed.data.SUPABASE_SECRET_KEY).toBeUndefined()
  })

  it('accepts a fully configured sandbox environment', () => {
    const parsed = parseServerEnv({
      SUPABASE_SECRET_KEY: 'sb_secret_x',
      PAYMENT_PROVIDER: 'wompi',
      WOMPI_PUBLIC_KEY: 'pub_test_abc',
      WOMPI_PRIVATE_KEY: 'prv_test_abc',
      WOMPI_EVENTS_SECRET: 'test_events_abc',
      WOMPI_INTEGRITY_SECRET: 'test_integrity_abc',
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'vapid_pub',
      VAPID_PRIVATE_KEY: 'vapid_priv',
      VAPID_SUBJECT: 'mailto:ops@tienda.app',
    })
    expect(parsed.success).toBe(true)
  })

  // A dashboard variable created and left blank is an ordinary thing to have
  // (Vercel, .env files). It must read as "unset", not as an invalid value
  // that bricks the build: the public env already does this, the server env
  // did not, and a deployment failed on an empty SENTRY_DSN.
  it('treats an empty string as unset', () => {
    const parsed = parseServerEnv({
      SENTRY_DSN: '',
      WOMPI_PUBLIC_KEY: '',
      WOMPI_EVENTS_SECRET: '',
      VAPID_SUBJECT: '',
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.SENTRY_DSN).toBeUndefined()
    expect(parsed.data.WOMPI_PUBLIC_KEY).toBeUndefined()
    expect(sentryConfiguredFrom(parsed.data)).toBe(false)
    expect(wompiConfiguredFrom(parsed.data)).toBe(false)
  })

  it('trims surrounding whitespace, the usual copy-paste accident', () => {
    const parsed = parseServerEnv({ WOMPI_PUBLIC_KEY: '  pub_prod_abc ' })
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.WOMPI_PUBLIC_KEY).toBe('pub_prod_abc')
  })

  it('still rejects a wrong prefix once trimmed', () => {
    const parsed = parseServerEnv({ WOMPI_PRIVATE_KEY: '  pub_prod_abc ' })
    expect(parsed.success).toBe(false)
  })

  it('treats whitespace-only as unset', () => {
    const parsed = parseServerEnv({ SENTRY_DSN: '   ' })
    expect(parsed.success).toBe(true)
  })

  it('rejects a Wompi public key without the expected prefix', () => {
    const parsed = parseServerEnv({ WOMPI_PUBLIC_KEY: 'not-a-key' })
    expect(parsed.success).toBe(false)
  })

  it('rejects a malformed VAPID_SUBJECT', () => {
    const parsed = parseServerEnv({ VAPID_SUBJECT: 'ops@tienda.app' })
    expect(parsed.success).toBe(false)
  })

  it('accepts a Sentry DSN and rejects anything that is not one', () => {
    expect(parseServerEnv({ SENTRY_DSN: DSN }).success).toBe(true)
    expect(parseServerEnv({ SENTRY_DSN: 'https://sentry.io' }).success).toBe(false)
    expect(parseServerEnv({ SENTRY_DSN: 'abc123' }).success).toBe(false)
  })

  it('falls back to SUPABASE_SERVICE_ROLE_KEY when present', () => {
    const parsed = parseServerEnv({
      SUPABASE_SERVICE_ROLE_KEY: 'legacy-jwt',
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.SUPABASE_SERVICE_ROLE_KEY).toBe('legacy-jwt')
  })
})

describe('wompiConfiguredFrom', () => {
  it('is false when any Wompi key is missing', () => {
    expect(wompiConfiguredFrom({})).toBe(false)
    expect(
      wompiConfiguredFrom({
        WOMPI_PUBLIC_KEY: 'pub_test_a',
        WOMPI_PRIVATE_KEY: 'prv_test_a',
      }),
    ).toBe(false)
  })

  it('is true once every Wompi key is set', () => {
    expect(
      wompiConfiguredFrom({
        WOMPI_PUBLIC_KEY: 'pub_test_a',
        WOMPI_PRIVATE_KEY: 'prv_test_a',
        WOMPI_EVENTS_SECRET: 'test_events_a',
        WOMPI_INTEGRITY_SECRET: 'test_integrity_a',
      }),
    ).toBe(true)
  })
})

describe('pushConfiguredFrom', () => {
  it('is false when any push key is missing', () => {
    expect(pushConfiguredFrom({})).toBe(false)
  })

  it('is true once every push key is set', () => {
    expect(
      pushConfiguredFrom({
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'vapid_pub',
        VAPID_PRIVATE_KEY: 'vapid_priv',
        VAPID_SUBJECT: 'mailto:ops@tienda.app',
      }),
    ).toBe(true)
  })
})

describe('sentryConfiguredFrom', () => {
  it('is false with no DSN, so the app runs with error reporting off', () => {
    expect(sentryConfiguredFrom({})).toBe(false)
    expect(sentryConfiguredFrom({ SENTRY_ENVIRONMENT: 'production' })).toBe(false)
  })

  it('is true on the DSN alone; the environment label is optional', () => {
    expect(sentryConfiguredFrom({ SENTRY_DSN: DSN })).toBe(true)
  })
})
