import { describe, expect, it } from 'vitest'
import { masonryRatio, menuLayoutStrategy } from '@/lib/store/menu-layout'
import { THEME_MENU_LAYOUTS } from '@/types/app'

describe('menuLayoutStrategy', () => {
  it('answers for every published layout', () => {
    for (const layout of THEME_MENU_LAYOUTS) {
      const strategy = menuLayoutStrategy(layout)
      expect(strategy.container.length).toBeGreaterThan(0)
      expect(typeof strategy.item(0)).toBe('string')
    }
  })

  it('lays the grid out in columns', () => {
    const strategy = menuLayoutStrategy('grid')
    expect(strategy.orientation).toBe('column')
    expect(strategy.container).toContain('grid')
    expect(strategy.feature(0)).toBe(false)
    expect(strategy.fixedRatio).toBe(true)
  })

  it('stacks the list with the image on the side', () => {
    const strategy = menuLayoutStrategy('list')
    expect(strategy.orientation).toBe('row')
    expect(strategy.container).toContain('flex-col')
    expect(strategy.feature(3)).toBe(false)
  })

  it('gives the magazine layout a double-width first item', () => {
    const strategy = menuLayoutStrategy('magazine')
    expect(strategy.feature(0)).toBe(true)
    expect(strategy.feature(1)).toBe(false)
    expect(strategy.item(0)).toContain('col-span-2')
    expect(strategy.item(1)).not.toContain('col-span-2')
  })

  it('uses CSS columns and natural heights for masonry', () => {
    const strategy = menuLayoutStrategy('masonry')
    expect(strategy.container).toContain('columns-')
    expect(strategy.item(0)).toContain('break-inside-avoid')
    expect(strategy.fixedRatio).toBe(false)
  })

  it('falls back to the grid for an unknown layout', () => {
    const unknown = 'nope' as never
    expect(menuLayoutStrategy(unknown)).toEqual(menuLayoutStrategy('grid'))
  })

  it('is a pure lookup: the same layout gives the same classes', () => {
    expect(menuLayoutStrategy('magazine').item(0)).toBe(
      menuLayoutStrategy('magazine').item(0),
    )
  })
})

describe('masonryRatio', () => {
  it('is deterministic per seed, so nothing reflows between renders', () => {
    expect(masonryRatio('product-1')).toBe(masonryRatio('product-1'))
  })

  it('always returns a usable CSS aspect ratio', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      expect(masonryRatio(seed)).toMatch(/^\d+ \/ \d+$/)
    }
  })

  it('spreads several seeds across more than one height', () => {
    const seeds = Array.from({ length: 24 }, (_, index) => `product-${index}`)
    expect(new Set(seeds.map(masonryRatio)).size).toBeGreaterThan(1)
  })
})
