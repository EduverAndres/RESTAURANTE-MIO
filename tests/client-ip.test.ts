import { describe, expect, it } from 'vitest'
import { clientIp } from '@/lib/http/client-ip'

function headers(values: Record<string, string>): Headers {
  return new Headers(values)
}

describe('clientIp', () => {
  it('takes the first entry of x-forwarded-for, which the platform prepends', () => {
    expect(
      clientIp(headers({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18, 150.172.238.178' })),
    ).toBe('203.0.113.7')
  })

  it('trims and lower-cases so one address is one bucket key', () => {
    expect(clientIp(headers({ 'x-forwarded-for': '  2001:DB8::1 , 10.0.0.1' }))).toBe(
      '2001:db8::1',
    )
  })

  it('falls back to x-real-ip when there is no forwarded chain', () => {
    expect(clientIp(headers({ 'x-real-ip': '203.0.113.9' }))).toBe('203.0.113.9')
  })

  it('answers null when no proxy header is present', () => {
    expect(clientIp(headers({}))).toBeNull()
  })

  it('answers null for an empty or blank header rather than an empty key', () => {
    expect(clientIp(headers({ 'x-forwarded-for': '' }))).toBeNull()
    expect(clientIp(headers({ 'x-forwarded-for': '   ,  ' }))).toBeNull()
  })
})
