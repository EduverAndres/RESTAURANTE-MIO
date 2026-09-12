import { describe, expect, it } from 'vitest'
import { resolveSections } from '@/lib/store/sections'

describe('resolveSections', () => {
  it('honours the given order', () => {
    expect(resolveSections(['menu', 'hero', 'featured', 'info'])).toEqual([
      'menu',
      'hero',
      'featured',
      'info',
    ])
  })

  it('drops duplicates, keeping the first position', () => {
    expect(
      resolveSections(['hero', 'menu', 'hero', 'featured', 'info']),
    ).toEqual(['hero', 'menu', 'featured', 'info'])
  })

  it('appends the core sections that the order forgot', () => {
    expect(resolveSections(['story'], { story: true })).toEqual([
      'story',
      'hero',
      'featured',
      'menu',
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
      resolveSections(['hero', 'featured', 'menu', 'info'], {
        featured: false,
        info: false,
      }),
    ).toEqual(['hero', 'menu'])
  })

  it('never drops hero or menu', () => {
    expect(resolveSections([], { info: false, featured: false })).toEqual([
      'hero',
      'menu',
    ])
  })

  it('treats an unknown availability entry as available', () => {
    expect(resolveSections(['hero', 'menu', 'social'])).toEqual([
      'hero',
      'menu',
      'social',
      'featured',
      'info',
    ])
  })
})
