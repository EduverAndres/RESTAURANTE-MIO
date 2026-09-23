import { describe, expect, it } from 'vitest'
import { startupWarnings } from '@/lib/config/startup-warnings'

const PRODUCTION = { NODE_ENV: 'production' } as const

function codes(env: Parameters<typeof startupWarnings>[0]): string[] {
  return startupWarnings(env).map((warning) => warning.code)
}

describe('startupWarnings', () => {
  describe('outside production', () => {
    it('stays silent with nothing configured', () => {
      expect(startupWarnings({ NODE_ENV: 'development' })).toEqual([])
    })

    it('stays silent with the mock gateway on and no time zone', () => {
      expect(
        startupWarnings({ NODE_ENV: 'development', PAYMENT_PROVIDER: 'mock' }),
      ).toEqual([])
    })

    it('treats a missing NODE_ENV as not production', () => {
      expect(startupWarnings({ PAYMENT_PROVIDER: 'mock' })).toEqual([])
    })
  })

  describe('time zone', () => {
    it('warns in production when TZ is unset', () => {
      expect(codes({ ...PRODUCTION, TZ: undefined })).toContain('time_zone_unset')
    })

    it('warns when TZ is set to an empty string', () => {
      expect(codes({ ...PRODUCTION, TZ: '' })).toContain('time_zone_unset')
    })

    it('warns when TZ is only whitespace', () => {
      expect(codes({ ...PRODUCTION, TZ: '   ' })).toContain('time_zone_unset')
    })

    it('stays silent once TZ is set', () => {
      expect(codes({ ...PRODUCTION, TZ: 'America/Bogota' })).not.toContain(
        'time_zone_unset',
      )
    })

    it('accepts any IANA zone, not just the Colombian one', () => {
      expect(codes({ ...PRODUCTION, TZ: 'Europe/Madrid' })).not.toContain(
        'time_zone_unset',
      )
    })

    it('explains the consequence rather than naming the variable', () => {
      const warning = startupWarnings({ ...PRODUCTION }).find(
        (candidate) => candidate.code === 'time_zone_unset',
      )
      expect(warning?.message).toMatch(/UTC/)
      expect(warning?.message).toMatch(/TZ/)
    })
  })

  describe('mock payment gateway', () => {
    it('warns in production when the mock gateway is selected', () => {
      expect(
        codes({ ...PRODUCTION, TZ: 'America/Bogota', PAYMENT_PROVIDER: 'mock' }),
      ).toContain('mock_payments_live')
    })

    it('stays silent for a real provider', () => {
      expect(
        codes({ ...PRODUCTION, TZ: 'America/Bogota', PAYMENT_PROVIDER: 'wompi' }),
      ).not.toContain('mock_payments_live')
    })

    it('stays silent for cash', () => {
      expect(
        codes({ ...PRODUCTION, TZ: 'America/Bogota', PAYMENT_PROVIDER: 'cash' }),
      ).not.toContain('mock_payments_live')
    })

    it('stays silent when no provider is configured', () => {
      expect(codes({ ...PRODUCTION, TZ: 'America/Bogota' })).not.toContain(
        'mock_payments_live',
      )
    })

    it('ignores casing and surrounding whitespace, as the env file might carry either', () => {
      expect(
        codes({ ...PRODUCTION, TZ: 'America/Bogota', PAYMENT_PROVIDER: ' MOCK ' }),
      ).toContain('mock_payments_live')
    })

    it('says the gateway approves charges, not merely that it is a mock', () => {
      const warning = startupWarnings({
        ...PRODUCTION,
        PAYMENT_PROVIDER: 'mock',
      }).find((candidate) => candidate.code === 'mock_payments_live')
      expect(warning?.message).toMatch(/approves/i)
    })
  })

  it('reports both problems at once rather than stopping at the first', () => {
    expect(codes({ ...PRODUCTION, PAYMENT_PROVIDER: 'mock' })).toEqual([
      'time_zone_unset',
      'mock_payments_live',
    ])
  })

  it('is silent on a correctly configured production deployment', () => {
    expect(
      startupWarnings({
        NODE_ENV: 'production',
        TZ: 'America/Bogota',
        PAYMENT_PROVIDER: 'wompi',
      }),
    ).toEqual([])
  })
})
