import { describe, expect, it } from 'vitest'
import { optionGroupIssue } from '@/lib/menu/options'
import { moveItem, positionUpdates } from '@/lib/menu/reorder'
import { formatTags, parseTags } from '@/lib/menu/tags'

const items = [
  { id: 'a', position: 0 },
  { id: 'b', position: 1 },
  { id: 'c', position: 2 },
]

describe('moveItem', () => {
  it('swaps with the previous neighbour when moving up', () => {
    expect(moveItem(items, 'b', 'up').map((item) => item.id)).toEqual([
      'b',
      'a',
      'c',
    ])
  })

  it('swaps with the next neighbour when moving down', () => {
    expect(moveItem(items, 'b', 'down').map((item) => item.id)).toEqual([
      'a',
      'c',
      'b',
    ])
  })

  it('returns the same order at the boundaries or for unknown ids', () => {
    expect(moveItem(items, 'a', 'up')).toEqual(items)
    expect(moveItem(items, 'c', 'down')).toEqual(items)
    expect(moveItem(items, 'zzz', 'down')).toEqual(items)
  })

  it('does not mutate the input', () => {
    const copy = items.map((item) => ({ ...item }))
    moveItem(copy, 'a', 'down')
    expect(copy).toEqual(items)
  })
})

describe('positionUpdates', () => {
  it('assigns positions by index and only reports rows that changed', () => {
    const reordered = moveItem(items, 'b', 'up')
    expect(positionUpdates(reordered)).toEqual([
      { id: 'b', position: 0 },
      { id: 'a', position: 1 },
    ])
  })

  it('normalises duplicated positions coming from the default column value', () => {
    const unordered = [
      { id: 'x', position: 0 },
      { id: 'y', position: 0 },
      { id: 'z', position: 0 },
    ]
    expect(positionUpdates(unordered)).toEqual([
      { id: 'y', position: 1 },
      { id: 'z', position: 2 },
    ])
  })

  it('returns an empty list when nothing moved', () => {
    expect(positionUpdates(items)).toEqual([])
  })
})

describe('optionGroupIssue', () => {
  it('accepts a consistent group', () => {
    expect(
      optionGroupIssue({ required: false, min: 0, max: 2, valueCount: 3 }),
    ).toBeNull()
    expect(
      optionGroupIssue({ required: true, min: 1, max: 1, valueCount: 2 }),
    ).toBeNull()
  })

  it('rejects a maximum below the minimum', () => {
    expect(
      optionGroupIssue({ required: false, min: 2, max: 1, valueCount: 3 }),
    ).toMatch(/máximo/i)
  })

  it('requires at least one choice when the group is required', () => {
    expect(
      optionGroupIssue({ required: true, min: 0, max: 1, valueCount: 2 }),
    ).toMatch(/obligatorio/i)
  })

  it('rejects a minimum larger than the number of values', () => {
    expect(
      optionGroupIssue({ required: true, min: 3, max: 3, valueCount: 2 }),
    ).toMatch(/opciones/i)
  })

  it('rejects groups without values', () => {
    expect(
      optionGroupIssue({ required: false, min: 0, max: 1, valueCount: 0 }),
    ).toMatch(/al menos/i)
  })
})

describe('parseTags', () => {
  it('splits by comma, trims and drops empties', () => {
    expect(parseTags('vegano, sin gluten,,  Picante ')).toEqual([
      'vegano',
      'sin gluten',
      'Picante',
    ])
  })

  it('dedupes case-insensitively keeping the first spelling', () => {
    expect(parseTags('Vegano, vegano, VEGANO, nuevo')).toEqual([
      'Vegano',
      'nuevo',
    ])
  })

  it('caps the number of tags and the length of each one', () => {
    const many = Array.from({ length: 12 }, (_, i) => `t${i}`).join(',')
    expect(parseTags(many)).toHaveLength(8)
    expect(parseTags('x'.repeat(40))[0]).toHaveLength(24)
  })

  it('returns an empty list for blank input', () => {
    expect(parseTags('')).toEqual([])
    expect(parseTags('  ,  ')).toEqual([])
  })
})

describe('formatTags', () => {
  it('joins with a comma and a space', () => {
    expect(formatTags(['a', 'b'])).toBe('a, b')
    expect(formatTags([])).toBe('')
  })
})
