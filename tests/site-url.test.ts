import { afterEach, describe, expect, it, vi } from 'vitest'
import { foreignPublicHost } from '@/lib/http/request-origin'
import {
  absoluteUrl,
  normaliseSiteUrl,
  siteUrl,
  storeUrl,
} from '@/lib/site-url'

const site = vi.hoisted(() => ({ url: 'http://44.213.146.211' }))

vi.mock('@/lib/env', () => ({
  env: {
    get NEXT_PUBLIC_SITE_URL() {
      return site.url
    },
    NEXT_PUBLIC_ROOT_DOMAIN: '44.213.146.211',
    NEXT_PUBLIC_STORE_SUBDOMAINS: false,
  },
}))

afterEach(() => {
  site.url = 'http://44.213.146.211'
})

describe('siteUrl', () => {
  it('normalises the configured value to a bare origin', () => {
    site.url = ' https://cerquita.app/ '
    expect(siteUrl()).toBe('https://cerquita.app')
    expect(normaliseSiteUrl('http://44.213.146.211/algo?x=1')).toBe(
      'http://44.213.146.211',
    )
    expect(normaliseSiteUrl('javascript:alert(1)')).toBeNull()
    expect(normaliseSiteUrl('ftp://host')).toBeNull()
    expect(normaliseSiteUrl(undefined)).toBeNull()
  })

  it('builds every public URL from the same origin', () => {
    expect(siteUrl()).toBe('http://44.213.146.211')
    expect(absoluteUrl('/orders/1')).toBe('http://44.213.146.211/orders/1')
    expect(absoluteUrl('api/webhooks/mercadopago')).toBe(
      'http://44.213.146.211/api/webhooks/mercadopago',
    )
    expect(storeUrl('sushi-nocturno')).toBe(
      'http://44.213.146.211/t/sushi-nocturno',
    )
  })
})

describe('foreignPublicHost', () => {
  const site = 'http://3.81.127.39'

  it('flags a public host that is not the site (stale site URL)', () => {
    expect(
      foreignPublicHost(new Headers({ host: '44.213.146.211' }), site),
    ).toBe('44.213.146.211')
    expect(
      foreignPublicHost(
        new Headers({ host: '127.0.0.1:3000', 'x-forwarded-host': 'evil.com' }),
        site,
      ),
    ).toBe('evil.com')
  })

  it('stays quiet for the site itself and for local hosts', () => {
    expect(foreignPublicHost(new Headers({ host: '3.81.127.39' }), site)).toBe(
      null,
    )
    for (const host of ['localhost:3000', '127.0.0.1:3000', '192.168.1.16']) {
      expect(foreignPublicHost(new Headers({ host }), site)).toBeNull()
    }
    expect(foreignPublicHost(new Headers(), site)).toBeNull()
  })
})
