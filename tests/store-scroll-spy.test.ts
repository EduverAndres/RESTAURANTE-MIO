import { describe, expect, it } from 'vitest'
import {
  mergeSpyEntries,
  pickActiveSection,
  type SpyEntry,
} from '@/lib/store/scroll-spy'

const entry = (id: string, isIntersecting: boolean, top: number): SpyEntry => ({
  id,
  isIntersecting,
  top,
})

describe('pickActiveSection', () => {
  it('returns null for an empty list without a previous value', () => {
    expect(pickActiveSection([], null)).toBeNull()
  })

  it('keeps the previous value when nothing intersects', () => {
    expect(
      pickActiveSection([entry('a', false, -900), entry('b', false, 900)], 'a'),
    ).toBe('a')
  })

  it('picks the topmost visible section below the header', () => {
    expect(
      pickActiveSection(
        [entry('a', true, 20), entry('b', true, 400), entry('c', false, 1200)],
        null,
      ),
    ).toBe('a')
  })

  it('prefers the section that already crossed the header over the next one', () => {
    // "a" starts above the fold, "b" is still further down: "a" is current.
    expect(
      pickActiveSection([entry('a', true, -120), entry('b', true, 500)], null),
    ).toBe('a')
  })

  it('falls back to the closest section above when everything scrolled past', () => {
    expect(
      pickActiveSection(
        [entry('a', true, -900), entry('b', true, -40), entry('c', false, 900)],
        null,
      ),
    ).toBe('b')
  })

  it('is stable while the same section stays in view', () => {
    const entries = [entry('a', true, -10), entry('b', true, 620)]
    expect(pickActiveSection(entries, 'b')).toBe('a')
    expect(pickActiveSection(entries, 'a')).toBe('a')
  })
})

describe('mergeSpyEntries', () => {
  it('replaces by id and keeps the original order', () => {
    const current = [
      entry('a', true, 0),
      entry('b', false, 500),
      entry('c', false, 900),
    ]
    const merged = mergeSpyEntries(current, [entry('c', true, 120)])
    expect(merged.map((item) => item.id)).toEqual(['a', 'b', 'c'])
    expect(merged[2]).toEqual(entry('c', true, 120))
  })

  it('ignores ids that are not being tracked', () => {
    const current = [entry('a', true, 0)]
    expect(mergeSpyEntries(current, [entry('zz', true, 10)])).toEqual(current)
  })

  it('does not mutate the input', () => {
    const current = [entry('a', true, 0)]
    mergeSpyEntries(current, [entry('a', false, 80)])
    expect(current[0]).toEqual(entry('a', true, 0))
  })
})
