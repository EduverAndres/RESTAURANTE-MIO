import { describe, expect, it } from 'vitest'
import { formatCOP, initialsOf } from '@/lib/format'

const NBSP = ' '

describe('formatCOP', () => {
  it('formats whole pesos with a dot as thousands separator and no decimals', () => {
    expect(formatCOP(18900)).toBe(`$${NBSP}18.900`)
    expect(formatCOP(1250000)).toBe(`$${NBSP}1.250.000`)
  })

  it('uses a non-breaking space between the symbol and the amount', () => {
    expect(formatCOP(18900)).toContain(NBSP)
    expect(formatCOP(18900)).not.toContain('$ 1')
  })

  it('rounds fractional amounts to whole pesos', () => {
    expect(formatCOP(18900.4)).toBe(`$${NBSP}18.900`)
    expect(formatCOP(18900.6)).toBe(`$${NBSP}18.901`)
  })

  it('formats zero and small amounts', () => {
    expect(formatCOP(0)).toBe(`$${NBSP}0`)
    expect(formatCOP(900)).toBe(`$${NBSP}900`)
  })

  it('keeps the sign for negative amounts', () => {
    expect(formatCOP(-5000)).toBe(`-$${NBSP}5.000`)
  })
})

describe('initialsOf', () => {
  it('uses first and last name initials in upper case', () => {
    expect(initialsOf('mauricio restrepo')).toBe('MR')
  })

  it('uses a single initial for one-word names', () => {
    expect(initialsOf('Daniela')).toBe('D')
  })

  it('ignores extra whitespace and uses the last word as surname', () => {
    expect(initialsOf('  Ana  María  Ruiz ')).toBe('AR')
  })

  it('returns a placeholder for empty names', () => {
    expect(initialsOf('   ')).toBe('?')
  })
})
