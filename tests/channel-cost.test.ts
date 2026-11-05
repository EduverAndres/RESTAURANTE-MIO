import { describe, expect, it } from 'vitest'
import { compareChannelCost } from '@/lib/marketing/channel-cost'

const ours = { ourCommissionPct: 6, ourOnlinePct: 5, ourMonthlyFee: 0 }

describe('compareChannelCost', () => {
  it('compares the app the merchant uses today with Cerquita', () => {
    const result = compareChannelCost({
      monthlyRevenue: 10_000_000,
      commissionPct: 25,
      onlineSharePct: 50,
      ...ours,
    })
    // Half online: 6% + 5% × 0.5 = 8.5% on average.
    expect(result).toEqual({
      marketplaceCost: 2_500_000,
      ourCost: 850_000,
      ourEffectivePct: 8.5,
      monthlySaving: 1_650_000,
      yearlySaving: 19_800_000,
      worthIt: true,
    })
  })

  it('charges only the base commission when nothing is paid online', () => {
    const result = compareChannelCost({
      monthlyRevenue: 4_000_000,
      commissionPct: 20,
      onlineSharePct: 0,
      ...ours,
    })
    expect(result.ourEffectivePct).toBe(6)
    expect(result.ourCost).toBe(240_000)
  })

  it('adds the plan fee to our side', () => {
    const result = compareChannelCost({
      monthlyRevenue: 10_000_000,
      commissionPct: 25,
      onlineSharePct: 100,
      ...ours,
      ourMonthlyFee: 129_900,
    })
    expect(result.ourCost).toBe(1_100_000 + 129_900)
  })

  it('says so honestly when the current app is cheaper', () => {
    const result = compareChannelCost({
      monthlyRevenue: 5_000_000,
      commissionPct: 5,
      onlineSharePct: 100,
      ...ours,
    })
    expect(result.monthlySaving).toBeLessThan(0)
    expect(result.worthIt).toBe(false)
  })

  it('does not call breaking even a saving', () => {
    const result = compareChannelCost({
      monthlyRevenue: 1_000_000,
      commissionPct: 6,
      onlineSharePct: 0,
      ...ours,
    })
    expect(result.monthlySaving).toBe(0)
    expect(result.worthIt).toBe(false)
  })

  it('treats garbage input as zero instead of producing NaN', () => {
    const result = compareChannelCost({
      monthlyRevenue: Number.NaN,
      commissionPct: Number.POSITIVE_INFINITY,
      onlineSharePct: -20,
      ...ours,
    })
    expect(result).toEqual({
      marketplaceCost: 0,
      ourCost: 0,
      ourEffectivePct: 6,
      monthlySaving: 0,
      yearlySaving: 0,
      worthIt: false,
    })
  })

  it('clamps rates and shares to 0–100', () => {
    const result = compareChannelCost({
      monthlyRevenue: 1_000_000,
      commissionPct: 250,
      onlineSharePct: 400,
      ...ours,
    })
    expect(result.marketplaceCost).toBe(1_000_000)
    expect(result.ourEffectivePct).toBe(11)
  })
})
