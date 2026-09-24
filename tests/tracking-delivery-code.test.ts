import { describe, expect, it } from 'vitest'
import {
  deliveryCodeMatches,
  deliveryCodeSchema,
  generateDeliveryCode,
} from '@/lib/tracking/delivery-code'

/** Deterministic random source returning the given draws in order. */
function drawsOf(values: number[]): () => number {
  let i = 0
  return () => {
    const value = values[i] ?? values[values.length - 1] ?? 0
    i += 1
    return value
  }
}

describe('generateDeliveryCode', () => {
  // Draws sit in the middle of their bucket (x.xxxx5) so binary floating
  // point cannot round 0.6789 * 10000 down to 6788.
  it('returns four zero-padded digits', () => {
    expect(generateDeliveryCode(drawsOf([0.00425]))).toBe('0042')
    expect(generateDeliveryCode(drawsOf([0.73915]))).toBe('7391')
  })

  it('rejects all-equal codes and draws again', () => {
    expect(generateDeliveryCode(drawsOf([0.11115, 0.22225, 0.83055]))).toBe(
      '8305',
    )
    expect(generateDeliveryCode(drawsOf([0, 0.48265]))).toBe('4826')
  })

  it('rejects ascending and descending sequences', () => {
    expect(
      generateDeliveryCode(drawsOf([0.12345, 0.43215, 0.01235, 0.52715])),
    ).toBe('5271')
    expect(generateDeliveryCode(drawsOf([0.98765, 0.67895, 0.39075]))).toBe(
      '3907',
    )
  })

  it('is well-formed with the real random source', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateDeliveryCode()
      expect(code).toMatch(/^\d{4}$/)
      expect(new Set(code).size).toBeGreaterThan(1)
    }
  })

  it('does not loop forever on a broken random source', () => {
    expect(generateDeliveryCode(() => Number.NaN)).toMatch(/^\d{4}$/)
    expect(generateDeliveryCode(() => 2)).toMatch(/^\d{4}$/)
  })
})

describe('deliveryCodeMatches', () => {
  it('matches the exact code', () => {
    expect(deliveryCodeMatches('4826', '4826')).toBe(true)
  })

  it('ignores whitespace and separators in the entered code', () => {
    expect(deliveryCodeMatches('4826', ' 48 26 ')).toBe(true)
    expect(deliveryCodeMatches('4826', '48-26')).toBe(true)
  })

  it('rejects a different, shorter or longer code', () => {
    expect(deliveryCodeMatches('4826', '4827')).toBe(false)
    expect(deliveryCodeMatches('4826', '482')).toBe(false)
    expect(deliveryCodeMatches('4826', '48266')).toBe(false)
    expect(deliveryCodeMatches('4826', '')).toBe(false)
  })

  it('is false when there is no expected code', () => {
    expect(deliveryCodeMatches(null, '4826')).toBe(false)
    expect(deliveryCodeMatches(null, '')).toBe(false)
  })
})

describe('deliveryCodeSchema', () => {
  it('accepts exactly four digits, trimming whitespace', () => {
    expect(deliveryCodeSchema.parse('4826')).toBe('4826')
    expect(deliveryCodeSchema.parse(' 4826 ')).toBe('4826')
  })

  it('rejects anything else with a Spanish message', () => {
    for (const bad of ['482', '48267', 'abcd', '48 26', '']) {
      const result = deliveryCodeSchema.safeParse(bad)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          'Ingresa los 4 dígitos del código.',
        )
      }
    }
  })
})
