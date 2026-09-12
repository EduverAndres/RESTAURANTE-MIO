import { describe, expect, it } from 'vitest'
import { cn } from '@/lib/utils'

/**
 * The design system adds custom utilities (see docs/DESIGN.md) whose names
 * collide with Tailwind's own prefixes. tailwind-merge classifies any unknown
 * `text-*` as a colour, so `cn('text-display', 'text-white')` used to drop
 * `text-display` and render body-sized text. These tests pin the contract.
 */
describe('cn with design-system utilities', () => {
  it('keeps a fluid type utility alongside a colour utility', () => {
    expect(cn('text-display', 'text-white')).toContain('text-display')
    expect(cn('text-h1', 'text-[var(--store-text)]')).toContain('text-h1')
    expect(cn('text-lead', 'text-muted-foreground')).toContain('text-lead')
  })

  it('treats fluid type utilities as font sizes, so the last one wins', () => {
    expect(cn('text-display', 'text-h2')).toBe('text-h2')
    expect(cn('text-sm', 'text-h1')).toBe('text-h1')
    expect(cn('text-h1', 'text-sm')).toBe('text-sm')
  })

  it('keeps semantic spacing utilities distinct from other sides', () => {
    expect(cn('px-gutter', 'py-4')).toBe('px-gutter py-4')
    expect(cn('p-section', 'p-4')).toBe('p-4')
  })

  it('collapses tinted elevation utilities to the last one', () => {
    expect(cn('shadow-1', 'shadow-2')).toBe('shadow-2')
  })

  it('leaves component-level store utilities untouched', () => {
    const result = cn('store-card', 'text-white')
    expect(result).toContain('store-card')
    expect(result).toContain('text-white')
    expect(cn('surface-glass', 'store-chip')).toBe('surface-glass store-chip')
  })

  it('still merges plain Tailwind conflicts', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })
})
