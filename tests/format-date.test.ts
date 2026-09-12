import { describe, expect, it } from 'vitest'
import { formatDateCO } from '@/lib/format-date'

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
