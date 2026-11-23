import { describe, expect, it } from 'vitest'
import { formatDateCO, formatTimeCO } from '@/lib/format-date'

describe('formatDateCO', () => {
  it('formats a date as day, abbreviated month and year in es-CO', () => {
    // ICU abbreviations differ slightly across runtimes ("sept" / "sept."),
    // so only the stable parts are asserted.
    const formatted = formatDateCO(new Date(2026, 8, 12, 15, 30))
    expect(formatted).toMatch(/^12 /)
    expect(formatted).toMatch(/sep/i)
    expect(formatted).toMatch(/2026$/)
  })

  it('accepts an ISO string', () => {
    expect(formatDateCO('2026-01-05T12:00:00.000Z')).toMatch(/2026$/)
  })
})

describe('formatTimeCO', () => {
  it('formats in Bogotá time with plain spaces only, like the browser does', () => {
    const text = formatTimeCO('2026-11-23T18:05:00.000Z')
    expect(text).toMatch(/^01:05 p\. m\.$/)
    expect(text).not.toMatch(/[  ]/)
  })
})
