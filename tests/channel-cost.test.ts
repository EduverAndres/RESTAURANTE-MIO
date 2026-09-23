import { describe, expect, it } from 'vitest'
import {
  BREAK_EVEN_UNREACHABLE,
  compareChannelCost,
  type ChannelCostInput,
} from '@/lib/marketing/channel-cost'

function input(overrides: Partial<ChannelCostInput> = {}): ChannelCostInput {
  return {
    monthlyRevenue: 10_000_000,
    commissionPct: 25,
    subscription: 149_000,
    ...overrides,
  }
}

describe('compareChannelCost', () => {
  it('charges the marketplace its percentage of revenue', () => {
    const result = compareChannelCost(input())
    expect(result.marketplaceCost).toBe(2_500_000)
  })

  it('charges us the flat subscription, whatever the revenue', () => {
    const low = compareChannelCost(input({ monthlyRevenue: 2_000_000 }))
    const high = compareChannelCost(input({ monthlyRevenue: 80_000_000 }))
    expect(low.ourCost).toBe(149_000)
    expect(high.ourCost).toBe(149_000)
  })

  it('reports the monthly and yearly difference', () => {
    const result = compareChannelCost(input())
    expect(result.monthlySaving).toBe(2_351_000)
    expect(result.yearlySaving).toBe(2_351_000 * 12)
  })

  /**
   * The honest half. A flat fee is worse than a percentage below the break
   * even, and a calculator that hides that is a calculator nobody believes
   * the second time.
   */
  it('returns a negative saving when the flat fee costs more', () => {
    const result = compareChannelCost(
      input({ monthlyRevenue: 400_000, commissionPct: 25 }),
    )
    expect(result.marketplaceCost).toBe(100_000)
    expect(result.monthlySaving).toBe(-49_000)
    expect(result.worthIt).toBe(false)
  })

  it('flags the deal as worth it once the saving is positive', () => {
    expect(compareChannelCost(input()).worthIt).toBe(true)
  })

  it('treats breaking exactly even as not yet worth it', () => {
    const result = compareChannelCost(
      input({ monthlyRevenue: 596_000, commissionPct: 25 }),
    )
    expect(result.monthlySaving).toBe(0)
    expect(result.worthIt).toBe(false)
  })

  describe('break-even revenue', () => {
    it('is the revenue at which both channels cost the same', () => {
      const result = compareChannelCost(input())
      expect(result.breakEvenRevenue).toBe(596_000)

      const atBreakEven = compareChannelCost(
        input({ monthlyRevenue: result.breakEvenRevenue }),
      )
      expect(atBreakEven.monthlySaving).toBe(0)
    })

    it('does not move with the revenue typed in', () => {
      const a = compareChannelCost(input({ monthlyRevenue: 1_000_000 }))
      const b = compareChannelCost(input({ monthlyRevenue: 90_000_000 }))
      expect(a.breakEvenRevenue).toBe(b.breakEvenRevenue)
    })

    it('is unreachable when no commission is charged', () => {
      const result = compareChannelCost(input({ commissionPct: 0 }))
      expect(result.breakEvenRevenue).toBe(BREAK_EVEN_UNREACHABLE)
      expect(result.worthIt).toBe(false)
    })
  })

  describe('guards against nonsense typed into the form', () => {
    it('floors a negative revenue at zero', () => {
      const result = compareChannelCost(input({ monthlyRevenue: -5_000_000 }))
      expect(result.marketplaceCost).toBe(0)
      expect(result.monthlySaving).toBe(-149_000)
    })

    it('floors a negative commission at zero', () => {
      const result = compareChannelCost(input({ commissionPct: -10 }))
      expect(result.marketplaceCost).toBe(0)
    })

    it('caps the commission at 100 percent', () => {
      const result = compareChannelCost(
        input({ monthlyRevenue: 1_000_000, commissionPct: 400 }),
      )
      expect(result.marketplaceCost).toBe(1_000_000)
    })

    it('floors a negative subscription at zero', () => {
      const result = compareChannelCost(input({ subscription: -1 }))
      expect(result.ourCost).toBe(0)
    })

    it('survives NaN without producing NaN', () => {
      const result = compareChannelCost(input({ monthlyRevenue: Number.NaN }))
      expect(Number.isFinite(result.marketplaceCost)).toBe(true)
      expect(Number.isFinite(result.monthlySaving)).toBe(true)
    })
  })

  it('returns whole pesos, never fractions', () => {
    const result = compareChannelCost(
      input({ monthlyRevenue: 3_333_333, commissionPct: 17.5 }),
    )
    for (const value of [
      result.marketplaceCost,
      result.ourCost,
      result.monthlySaving,
      result.yearlySaving,
      result.breakEvenRevenue,
    ]) {
      expect(Number.isInteger(value)).toBe(true)
    }
  })
})
