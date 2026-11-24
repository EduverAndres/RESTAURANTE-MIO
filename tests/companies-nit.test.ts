import { describe, expect, it } from 'vitest'
import {
  NIT_WEIGHTS,
  formatNit,
  isValidNit,
  nitCheckDigit,
  parseNit,
} from '@/lib/companies/nit'

describe('nitCheckDigit (DIAN, módulo 11)', () => {
  it.each([
    ['890903938', 8], // Bancolombia
    ['800197268', 4], // DIAN
    ['899999068', 1], // Ecopetrol
    ['860034313', 7], // Davivienda
    ['830122566', 1],
    ['900123456', 8],
  ])('%s → %i', (nit, dv) => {
    expect(nitCheckDigit(nit)).toBe(dv)
  })

  it('uses the remainder itself when it is 0 or 1', () => {
    // 1 × 3 = 3 → r = 3 → 8; find inputs that land on r = 0 and r = 1.
    const zero = Array.from({ length: 2000 }, (_, i) => String(i + 1)).find(
      (nit) => digitSum(nit) % 11 === 0,
    )!
    const one = Array.from({ length: 2000 }, (_, i) => String(i + 1)).find(
      (nit) => digitSum(nit) % 11 === 1,
    )!
    expect(nitCheckDigit(zero)).toBe(0)
    expect(nitCheckDigit(one)).toBe(1)
  })

  it('refuses anything that is not 1 to 15 digits', () => {
    expect(nitCheckDigit('')).toBeNull()
    expect(nitCheckDigit('90012345a')).toBeNull()
    expect(nitCheckDigit('1234567890123456')).toBeNull()
    expect(nitCheckDigit('900.123.456')).toBeNull()
  })

  it('weighs at most 15 digits, right to left', () => {
    expect(NIT_WEIGHTS).toHaveLength(15)
    expect(NIT_WEIGHTS[0]).toBe(3)
    expect(nitCheckDigit('123456789012345')).not.toBeNull()
  })
})

describe('parseNit', () => {
  it('reads the usual ways people write a NIT', () => {
    expect(parseNit('900.123.456-8')).toEqual({ nit: '900123456', dv: 8 })
    expect(parseNit(' 900123456 - 8 ')).toEqual({ nit: '900123456', dv: 8 })
    expect(parseNit('900 123 456-8')).toEqual({ nit: '900123456', dv: 8 })
    expect(parseNit('900123456')).toEqual({ nit: '900123456', dv: null })
  })

  it('returns null for something that is not a NIT', () => {
    expect(parseNit('')).toBeNull()
    expect(parseNit('abc')).toBeNull()
    expect(parseNit('900123456-88')).toBeNull()
    expect(parseNit('12345')).toBeNull()
  })
})

describe('isValidNit', () => {
  it('accepts the right check digit and refuses any other', () => {
    expect(isValidNit('890903938', 8)).toBe(true)
    for (const dv of [0, 1, 2, 3, 4, 5, 6, 7, 9]) {
      expect(isValidNit('890903938', dv)).toBe(false)
    }
  })

  it('needs 6 to 15 digits', () => {
    expect(isValidNit('12345', nitCheckDigit('12345')!)).toBe(false)
    expect(isValidNit('123456', nitCheckDigit('123456')!)).toBe(true)
  })
})

describe('formatNit', () => {
  it('groups thousands with dots and appends the check digit', () => {
    expect(formatNit('900123456', 8)).toBe('900.123.456-8')
    expect(formatNit('1234567', 0)).toBe('1.234.567-0')
  })
})

function digitSum(nit: string): number {
  return nit
    .split('')
    .reverse()
    .reduce((sum, digit, index) => sum + Number(digit) * NIT_WEIGHTS[index], 0)
}
