// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

// A sponsored click is counted by `record_ad_click` and always ends at the
// store. This suite pins both halves: what is counted (people, within a
// budget, on campaigns that exist) and that the visitor is redirected even
// when counting is skipped or fails.

const CAMPAIGN = '6f1c2b8e-3d4a-4e5f-9a0b-1c2d3e4f5a6b'
const BROWSER =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36'

interface FakeOptions {
  hitCount?: number
  recordResult?: { data: string | null; error: { message: string } | null }
  lookupSlug?: string | null
  throwOnCreate?: boolean
}

let options: FakeOptions
let calls: string[]

function fakeAdmin() {
  return {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push(name)
      if (name === 'consume_rate_limit') {
        return {
          data: [
            {
              hit_count: options.hitCount ?? 1,
              window_start: new Date().toISOString(),
            },
          ],
          error: null,
        }
      }
      if (name === 'record_ad_click') {
        expect(args).toEqual({ p_id: CAMPAIGN })
        return options.recordResult ?? { data: 'arepa-and-co', error: null }
      }
      throw new Error(`unexpected rpc ${name}`)
    },
    from(table: string) {
      calls.push(`from:${table}`)
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({
          data:
            options.lookupSlug === null
              ? null
              : { stores: { slug: options.lookupSlug ?? 'arepa-and-co' } },
          error: null,
        }),
      }
      return chain
    },
  }
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    if (options.throwOnCreate) throw new Error('no secret key')
    return fakeAdmin()
  },
}))

const { GET } = await import('@/app/api/ads/click/[campaignId]/route')

async function click(
  campaignId: string,
  headers: Record<string, string> = {
    'user-agent': BROWSER,
    'x-forwarded-for': '190.24.10.8',
  },
) {
  const request = new NextRequest(
    `http://localhost/api/ads/click/${campaignId}`,
    { headers },
  )
  return GET(request, { params: Promise.resolve({ campaignId }) })
}

beforeEach(() => {
  options = {}
  calls = []
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('GET /api/ads/click/[campaignId]', () => {
  it('counts a person’s click and redirects to the store, uncached', async () => {
    const response = await click(CAMPAIGN)
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/t/arepa-and-co')
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(response.headers.get('x-robots-tag')).toContain('noindex')
    expect(calls).toEqual(['consume_rate_limit', 'record_ad_click'])
  })

  it('sends an invalid id home without touching the database', async () => {
    const response = await click('not-a-uuid')
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/')
    expect(calls).toEqual([])
  })

  it('redirects a crawler or link preview without counting it', async () => {
    for (const userAgent of [
      'Googlebot/2.1 (+http://www.google.com/bot.html)',
      'facebookexternalhit/1.1',
      'WhatsApp/2.23.20.0',
      'curl/8.5.0',
      '',
    ]) {
      calls = []
      const response = await click(CAMPAIGN, {
        'user-agent': userAgent,
        'x-forwarded-for': '190.24.10.8',
      })
      expect(response.headers.get('location'), userAgent).toBe(
        '/t/arepa-and-co',
      )
      expect(calls, userAgent).toEqual(['from:ad_campaigns'])
    }
  })

  it('stops counting past the per-address budget, but still redirects', async () => {
    options.hitCount = 4
    const response = await click(CAMPAIGN)
    expect(response.headers.get('location')).toBe('/t/arepa-and-co')
    expect(calls).toEqual(['consume_rate_limit', 'from:ad_campaigns'])
  })

  it('counts without a budget when there is no proxy address', async () => {
    const response = await click(CAMPAIGN, { 'user-agent': BROWSER })
    expect(response.headers.get('location')).toBe('/t/arepa-and-co')
    expect(calls).toEqual(['record_ad_click'])
  })

  it('still reaches the store when counting fails', async () => {
    options.recordResult = { data: null, error: { message: 'boom' } }
    const response = await click(CAMPAIGN)
    expect(response.headers.get('location')).toBe('/t/arepa-and-co')
    expect(calls).toEqual([
      'consume_rate_limit',
      'record_ad_click',
      'from:ad_campaigns',
    ])
  })

  it('sends an unknown campaign home', async () => {
    options.recordResult = { data: null, error: null }
    options.lookupSlug = null
    const response = await click(CAMPAIGN)
    expect(response.headers.get('location')).toBe('/')
  })

  it('goes home when the server cannot reach the database at all', async () => {
    options.throwOnCreate = true
    const response = await click(CAMPAIGN)
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/')
  })

  it('never redirects anywhere but a store path on this site', async () => {
    options.recordResult = { data: '//evil.example/x', error: null }
    const response = await click(CAMPAIGN)
    expect(response.headers.get('location')).toBe('/')
  })
})
