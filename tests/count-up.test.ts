import { describe, expect, it } from 'vitest'
import { countFrame, easeOutCubic, formatCount } from '@/lib/motion/count'

describe('easeOutCubic', () => {
  it('starts at 0, ends at 1 and clamps outside that range', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
    expect(easeOutCubic(-1)).toBe(0)
    expect(easeOutCubic(2)).toBe(1)
  })

  it('front-loads the movement, so the number settles instead of braking late', () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5)
  })
})

describe('countFrame', () => {
  it('starts on the origin value', () => {
    expect(countFrame(0, 120, 0, 1000)).toEqual({ value: 0, done: false })
  })

  it('lands exactly on the target and reports it is done', () => {
    expect(countFrame(0, 120, 1000, 1000)).toEqual({ value: 120, done: true })
    expect(countFrame(0, 120, 5000, 1000)).toEqual({ value: 120, done: true })
  })

  it('moves monotonically toward the target in both directions', () => {
    const up = [0, 200, 400, 600, 800].map(
      (elapsed) => countFrame(10, 90, elapsed, 1000).value,
    )
    expect([...up].sort((a, b) => a - b)).toEqual(up)
    const down = [0, 250, 500, 750].map(
      (elapsed) => countFrame(90, 10, elapsed, 1000).value,
    )
    expect([...down].sort((a, b) => b - a)).toEqual(down)
  })

  it('jumps straight to the target when there is no time to animate', () => {
    expect(countFrame(0, 50, 0, 0)).toEqual({ value: 50, done: true })
    expect(countFrame(0, 50, 0, -10)).toEqual({ value: 50, done: true })
  })
})

describe('formatCount', () => {
  it('groups whole numbers the Colombian way', () => {
    expect(formatCount(1234, 'integer')).toBe('1.234')
    expect(formatCount(12.6, 'integer')).toBe('13')
  })

  it('keeps one decimal for averages, with a decimal comma', () => {
    expect(formatCount(4.66, 'decimal')).toBe('4,7')
    expect(formatCount(4, 'decimal')).toBe('4,0')
  })

  it('formats pesos with the app-wide currency shape', () => {
    expect(formatCount(18900, 'cop')).toBe('$ 18.900')
  })
})
