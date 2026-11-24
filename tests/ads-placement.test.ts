import { describe, expect, it } from 'vitest'
import {
  freeSlots,
  hasCapacity,
  overlapsOwn,
  peakOccupancy,
  sharesSlotPool,
  type SlotCampaign,
} from '@/lib/ads/capacity'
import {
  mergeFeatured,
  normalizeSearchText,
  pinSponsored,
  sameCategory,
  sponsoredHref,
  sponsoredItems,
  sponsoredLinkLabel,
  sponsorshipsForCategory,
  sponsorshipsForSearch,
  type Sponsorship,
} from '@/lib/ads/placement'

const store = (id: string) => ({ id, name: `Tienda ${id}` })

const sponsorship = (
  storeId: string,
  campaignId = `c-${storeId}`,
  category: string | null = null,
): Sponsorship => ({
  campaignId,
  storeId,
  slug: storeId,
  name: `Tienda ${storeId}`,
  category,
})

describe('sponsoredItems', () => {
  it('keeps the campaigns order, one per store, and tags each with its campaign', () => {
    const pool = [store('a'), store('b'), store('c')]
    const items = sponsoredItems(
      [sponsorship('c'), sponsorship('a'), sponsorship('c', 'c-again')],
      pool,
    )
    expect(items.map((item) => [item.id, item.sponsoredCampaignId])).toEqual([
      ['c', 'c-c'],
      ['a', 'c-a'],
    ])
  })

  it('skips a sponsored store the pool does not have', () => {
    expect(sponsoredItems([sponsorship('z')], [store('a')])).toEqual([])
  })
})

describe('mergeFeatured', () => {
  it('puts sponsored stores first, then VIP and founders, with no store twice', () => {
    const pool = [store('vip1'), store('paid'), store('vip2')]
    const sponsored = sponsoredItems(
      [sponsorship('paid'), sponsorship('vip2')],
      pool,
    )
    const merged = mergeFeatured(sponsored, [store('vip1'), store('vip2')])
    expect(merged.map((item) => item.id)).toEqual(['paid', 'vip2', 'vip1'])
    // A VIP store that also pays shows once, labelled as sponsored.
    expect(merged[1].sponsoredCampaignId).toBe('c-vip2')
    expect(merged[2].sponsoredCampaignId).toBeUndefined()
  })

  it('is just the plan featured list when nobody pays', () => {
    expect(mergeFeatured([], [store('vip1')]).map((item) => item.id)).toEqual([
      'vip1',
    ])
  })
})

describe('the category slot', () => {
  it('matches the category the campaign was bought for, ignoring case and accents', () => {
    expect(sameCategory('Café y panadería', 'cafe y panaderia')).toBe(true)
    expect(sameCategory('Parrilla', 'Japonesa')).toBe(false)
    expect(sameCategory(null, 'Parrilla')).toBe(false)
    const all = [
      sponsorship('a', 'c1', 'Parrilla'),
      sponsorship('b', 'c2', 'Japonesa'),
    ]
    expect(
      sponsorshipsForCategory(all, 'parrilla').map((s) => s.storeId),
    ).toEqual(['a'])
  })

  it('pins the sponsored store to the top of the grid without repeating it', () => {
    const grid = [store('x'), store('a'), store('y')]
    const pinned = pinSponsored(grid, sponsoredItems([sponsorship('a')], grid))
    expect(pinned.map((item) => item.id)).toEqual(['a', 'x', 'y'])
    expect(pinned[0].sponsoredCampaignId).toBe('c-a')
  })

  it('adds a sponsored store the grid did not include (fetched apart)', () => {
    const grid = [store('x')]
    const pinned = pinSponsored(
      grid,
      sponsoredItems([sponsorship('far')], [store('far')]),
    )
    expect(pinned.map((item) => item.id)).toEqual(['far', 'x'])
  })
})

describe('the search slot', () => {
  const all = [
    sponsorship('parrilla', 'c1', 'Parrilla'),
    sponsorship('sushi', 'c2', 'Japonesa'),
  ]

  it('shows a campaign only when it is relevant to what was typed', () => {
    expect(sponsorshipsForSearch(all, 'parri').map((s) => s.storeId)).toEqual([
      'parrilla',
    ])
    expect(
      sponsorshipsForSearch(all, 'JAPONÉSA').map((s) => s.storeId),
    ).toEqual(['sushi'])
    expect(
      sponsorshipsForSearch(all, 'tienda sushi').map((s) => s.storeId),
    ).toEqual(['sushi'])
    expect(sponsorshipsForSearch(all, 'pizza')).toEqual([])
  })

  it('also shows it when one of the store dishes matched', () => {
    expect(
      sponsorshipsForSearch(all, 'ramen', new Set(['sushi'])).map(
        (s) => s.storeId,
      ),
    ).toEqual(['sushi'])
  })

  it('waits for two characters, like the suggestions do', () => {
    expect(sponsorshipsForSearch(all, 'p')).toEqual([])
    expect(normalizeSearchText('  Café ')).toBe('cafe')
  })
})

describe('sponsored links', () => {
  it('go through the click counter and say they are sponsored', () => {
    expect(sponsoredHref('abc')).toBe('/api/ads/click/abc')
    expect(sponsoredLinkLabel('Arepa & Co')).toBe(
      'Ver Arepa & Co (patrocinado)',
    )
  })
})

// ---------------------------------------------------------------------------
// Capacity (mirrored by approve_ad_campaign)
// ---------------------------------------------------------------------------
const campaign = (
  overrides: Partial<SlotCampaign> &
    Pick<SlotCampaign, 'starts_on' | 'ends_on'>,
): SlotCampaign => ({
  placement: 'home_featured',
  status: 'active',
  category_snapshot: null,
  ...overrides,
})

describe('capacity', () => {
  const taken = [
    campaign({ id: '1', starts_on: '2026-11-23', ends_on: '2026-11-28' }),
    campaign({ id: '2', starts_on: '2026-11-23', ends_on: '2026-11-28' }),
    campaign({ id: '3', starts_on: '2026-11-25', ends_on: '2026-11-30' }),
  ]

  it('counts the busiest day of the request', () => {
    expect(
      peakOccupancy(taken, {
        placement: 'home_featured',
        starts_on: '2026-11-20',
        ends_on: '2026-11-24',
        category_snapshot: null,
      }),
    ).toBe(2)
    expect(
      peakOccupancy(taken, {
        placement: 'home_featured',
        starts_on: '2026-11-27',
        ends_on: '2026-12-02',
        category_snapshot: null,
      }),
    ).toBe(3)
  })

  it('fits a request only if every one of its days has a free slot', () => {
    const request = {
      placement: 'home_featured' as const,
      starts_on: '2026-11-24',
      ends_on: '2026-11-26',
      category_snapshot: null,
    }
    expect(hasCapacity(taken, request, 3)).toBe(false)
    expect(freeSlots(taken, request, 3)).toBe(0)
    expect(hasCapacity(taken, request, 4)).toBe(true)
    expect(
      hasCapacity(
        taken,
        { ...request, starts_on: '2026-12-01', ends_on: '2026-12-03' },
        3,
      ),
    ).toBe(true)
  })

  it('keeps a paused campaign in its slot and frees an ended one', () => {
    const request = {
      placement: 'home_featured' as const,
      starts_on: '2026-11-23',
      ends_on: '2026-11-24',
      category_snapshot: null,
    }
    const paused = [
      campaign({
        status: 'paused',
        starts_on: '2026-11-23',
        ends_on: '2026-11-24',
      }),
    ]
    expect(peakOccupancy(paused, request)).toBe(1)
    for (const status of [
      'ended',
      'requested',
      'rejected',
      'cancelled',
    ] as const) {
      expect(
        peakOccupancy(
          [
            campaign({
              status,
              starts_on: '2026-11-23',
              ends_on: '2026-11-24',
            }),
          ],
          request,
        ),
        status,
      ).toBe(0)
    }
  })

  it('counts category slots per category, and never a campaign against itself', () => {
    const parrilla = campaign({
      id: 'p1',
      placement: 'category_top',
      category_snapshot: 'Parrilla',
      starts_on: '2026-11-23',
      ends_on: '2026-11-30',
    })
    expect(
      sharesSlotPool(parrilla, {
        placement: 'category_top',
        category_snapshot: 'PARRILLA',
      }),
    ).toBe(true)
    expect(
      sharesSlotPool(parrilla, {
        placement: 'category_top',
        category_snapshot: 'Japonesa',
      }),
    ).toBe(false)
    expect(
      sharesSlotPool(parrilla, {
        placement: 'search_top',
        category_snapshot: 'Parrilla',
      }),
    ).toBe(false)
    expect(
      peakOccupancy([parrilla], {
        id: 'p1',
        placement: 'category_top',
        category_snapshot: 'Parrilla',
        starts_on: '2026-11-23',
        ends_on: '2026-11-30',
      }),
    ).toBe(0)
  })
})

describe('overlapsOwn', () => {
  const request = {
    placement: 'home_featured' as const,
    starts_on: '2026-11-24',
    ends_on: '2026-11-26',
    category_snapshot: null,
  }

  it('catches a waiting or approved campaign of the store on any requested day', () => {
    for (const status of ['requested', 'active', 'paused'] as const) {
      expect(
        overlapsOwn(
          [
            campaign({
              status,
              starts_on: '2026-11-26',
              ends_on: '2026-11-30',
            }),
          ],
          request,
        ),
        status,
      ).toBe(true)
    }
  })

  it('ignores other placements, other dates and campaigns that are over', () => {
    expect(
      overlapsOwn(
        [
          campaign({
            placement: 'search_top',
            starts_on: '2026-11-24',
            ends_on: '2026-11-26',
          }),
          campaign({ starts_on: '2026-11-27', ends_on: '2026-11-30' }),
          campaign({
            status: 'ended',
            starts_on: '2026-11-24',
            ends_on: '2026-11-26',
          }),
          campaign({
            status: 'rejected',
            starts_on: '2026-11-24',
            ends_on: '2026-11-26',
          }),
          campaign({
            status: 'cancelled',
            starts_on: '2026-11-24',
            ends_on: '2026-11-26',
          }),
        ],
        request,
      ),
    ).toBe(false)
  })
})
