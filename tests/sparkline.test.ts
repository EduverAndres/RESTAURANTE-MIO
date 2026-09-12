import { describe, expect, it } from 'vitest'
import { sparklineGeometry, trendDirection } from '@/lib/metrics/sparkline'

describe('sparklineGeometry', () => {
  it('returns null when there is nothing to draw', () => {
    expect(sparklineGeometry([], { width: 100, height: 24 })).toBeNull()
    expect(sparklineGeometry([4], { width: 100, height: 24 })).toBeNull()
  })

  it('spans the full width and puts the maximum on the top edge', () => {
    const geometry = sparklineGeometry([0, 10], { width: 100, height: 20 })
    expect(geometry?.line).toBe('M 0 20 L 100 0')
    expect(geometry?.last).toEqual({ x: 100, y: 0 })
  })

  it('leaves room above and below when padding is asked for', () => {
    const geometry = sparklineGeometry([0, 10], {
      width: 100,
      height: 20,
      padding: 2,
    })
    expect(geometry?.line).toBe('M 0 18 L 100 2')
  })

  it('draws a flat series through the middle instead of dividing by zero', () => {
    const geometry = sparklineGeometry([5, 5, 5], { width: 100, height: 20 })
    expect(geometry?.line).toBe('M 0 10 L 50 10 L 100 10')
  })

  it('closes the area path back along the baseline', () => {
    const geometry = sparklineGeometry([0, 10], { width: 100, height: 20 })
    expect(geometry?.area).toBe('M 0 20 L 100 0 L 100 20 L 0 20 Z')
  })

  it('rounds coordinates so the path stays short and stable', () => {
    const geometry = sparklineGeometry([0, 1, 3], { width: 10, height: 3 })
    expect(geometry?.line).toBe('M 0 3 L 5 2 L 10 0')
  })

  it('treats a negative value as the floor of the scale', () => {
    const geometry = sparklineGeometry([-10, 0], { width: 100, height: 20 })
    expect(geometry?.line).toBe('M 0 20 L 100 0')
  })
})

describe('trendDirection', () => {
  it('compares the last value against the mean of the ones before it', () => {
    expect(trendDirection([1, 1, 5])).toBe('up')
    expect(trendDirection([5, 5, 1])).toBe('down')
    expect(trendDirection([4, 4, 4])).toBe('flat')
  })

  it('is flat when there is not enough history to compare', () => {
    expect(trendDirection([])).toBe('flat')
    expect(trendDirection([7])).toBe('flat')
  })
})
