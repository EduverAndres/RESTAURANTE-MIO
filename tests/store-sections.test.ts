import { describe, expect, it } from 'vitest'
import { resolveSections } from '@/lib/store/sections'

describe('resolveSections', () => {
  it('honours the given order', () => {
    expect(
      resolveSections(['menu', 'hero', 'featured', 'reviews', 'info']),
    ).toEqual(['menu', 'hero', 'featured', 'reviews', 'info'])
  })

  it('drops duplicates, keeping the first position', () => {
    expect(
      resolveSections(['hero', 'menu', 'hero', 'featured', 'reviews', 'info']),
    ).toEqual(['hero', 'menu', 'featured', 'reviews', 'info'])
  })

  it('appends the core sections that the order forgot', () => {
    expect(resolveSections(['story'], { story: true })).toEqual([
      'story',
      'hero',
      'featured',
      'menu',
      'reviews',
      'info',
    ])
  })

  it('drops an opt-in section with nothing to show', () => {
    expect(
      resolveSections(['hero', 'story', 'menu', 'reviews', 'social', 'info'], {
        story: false,
        reviews: false,
        social: true,
      }),
    ).toEqual(['hero', 'menu', 'social', 'info', 'featured'])
  })

  it('drops empty core sections too, except hero and menu', () => {
    expect(
      resolveSections(['hero', 'featured', 'menu', 'reviews', 'info'], {
        featured: false,
        reviews: false,
        info: false,
      }),
    ).toEqual(['hero', 'menu'])
  })

  it('appends reviews as a core section when the store has some', () => {
    expect(
      resolveSections(['hero', 'menu', 'info'], { reviews: true }),
    ).toEqual(['hero', 'menu', 'info', 'featured', 'reviews'])
  })

  it('drops reviews when the store has none yet', () => {
    expect(
      resolveSections(['hero', 'menu', 'info'], { reviews: false }),
    ).toEqual(['hero', 'menu', 'info', 'featured'])
  })

  it('never drops hero or menu', () => {
    expect(
      resolveSections([], { info: false, featured: false, reviews: false }),
    ).toEqual(['hero', 'menu'])
  })

  it('treats an unknown availability entry as available', () => {
    expect(resolveSections(['hero', 'menu', 'social'])).toEqual([
      'hero',
      'menu',
      'social',
      'featured',
      'reviews',
      'info',
    ])
  })
})
