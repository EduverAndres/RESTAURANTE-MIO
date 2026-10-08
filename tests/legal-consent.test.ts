import { describe, expect, it } from 'vitest'
import {
  ACCEPT_PATH,
  hasAcceptedCurrent,
  isLegalExemptPath,
  LEGAL_DOCUMENTS,
  LEGAL_VERSION,
  legalMetadata,
  needsLegalAcceptance,
} from '@/lib/legal/consent'
import { parseConsent, readCookie, serializeConsent } from '@/lib/legal/cookies'
import { rewriteForStore } from '@/lib/subdomain'
import { loginSchema, registerSchema } from '@/lib/validations/auth'

describe('legal gate', () => {
  it('lets through only the current version', () => {
    expect(hasAcceptedCurrent({ legal_version: LEGAL_VERSION })).toBe(true)
    expect(hasAcceptedCurrent({ legal_version: '2000-01-01' })).toBe(false)
    expect(hasAcceptedCurrent({})).toBe(false)
    expect(hasAcceptedCurrent(null)).toBe(false)
  })

  it('keeps the documents, the gate and auth routes reachable', () => {
    for (const document of LEGAL_DOCUMENTS) {
      expect(isLegalExemptPath(document.href)).toBe(true)
    }
    for (const path of [
      ACCEPT_PATH,
      '/legal',
      '/auth/sign-out',
      '/auth/callback',
      '/api/webhooks/wompi',
      '/login',
      '/account/reset-password',
    ]) {
      expect(isLegalExemptPath(path)).toBe(true)
    }
  })

  it('stops an unaccepted session everywhere else', () => {
    for (const path of [
      '/',
      '/checkout',
      '/dashboard',
      '/t/sushi',
      '/account',
    ]) {
      expect(needsLegalAcceptance(path, {})).toBe(true)
      expect(needsLegalAcceptance(path, { legal_version: LEGAL_VERSION })).toBe(
        false,
      )
    }
  })

  it('does not treat look-alike paths as exempt', () => {
    expect(isLegalExemptPath('/login-falso')).toBe(false)
    expect(isLegalExemptPath('/legalidad')).toBe(false)
  })

  it('stamps version, time and source', () => {
    const now = new Date('2026-10-08T12:00:00.000Z')
    expect(legalMetadata('register', true, now)).toEqual({
      legal_version: LEGAL_VERSION,
      legal_accepted_at: '2026-10-08T12:00:00.000Z',
      legal_source: 'register',
      marketing_opt_in: true,
    })
    expect(legalMetadata('gate', undefined, now)).not.toHaveProperty(
      'marketing_opt_in',
    )
  })

  it('keeps legal pages app-wide on store subdomains', () => {
    expect(rewriteForStore('/terminos', 'sushi')).toBe('/terminos')
    expect(rewriteForStore(ACCEPT_PATH, 'sushi')).toBe(ACCEPT_PATH)
  })
})

describe('consent is express and unticked by default', () => {
  it('rejects login and sign-up without the box ticked', () => {
    expect(
      loginSchema.safeParse({
        email: 'a@b.co',
        password: 'x',
        accept_terms: false,
      }).success,
    ).toBe(false)
    const base = {
      full_name: 'Ana Pérez',
      email: 'ana@correo.co',
      password: 'secreto123',
      role: 'customer' as const,
    }
    expect(
      registerSchema.safeParse({ ...base, accept_terms: false }).success,
    ).toBe(false)
    const ok = registerSchema.safeParse({ ...base, accept_terms: true })
    expect(ok.success).toBe(true)
    // Marketing is never implied by accepting the terms.
    expect(ok.success && ok.data.marketing_opt_in).toBe(false)
  })
})

describe('cookie consent', () => {
  it('round-trips a choice', () => {
    const raw = serializeConsent({ analytics: true, marketing: false })
    expect(parseConsent(raw)).toMatchObject({
      analytics: true,
      marketing: false,
    })
  })

  it('treats anything malformed as no decision', () => {
    expect(parseConsent(null)).toBeNull()
    expect(parseConsent('basura')).toBeNull()
    expect(parseConsent(encodeURIComponent('{"v":99}'))).toBeNull()
  })

  it('reads one cookie out of a document.cookie string', () => {
    expect(readCookie('a=1; tienda_x=hola%3D; b=2', 'tienda_x')).toBe('hola%3D')
    expect(readCookie('a=1', 'tienda_x')).toBeNull()
  })
})
