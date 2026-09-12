// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// lib/env validates the public environment at import time, which is not
// available under vitest; the footer only needs the app name.
vi.mock('@/lib/env', () => ({ APP_NAME: 'Tienda' }))

const { SiteFooter } = await import('@/components/layout/site-footer')

describe('SiteFooter', () => {
  it('credits the vendor', () => {
    render(<SiteFooter />)
    const footer = screen.getByRole('contentinfo')
    expect(footer).toHaveTextContent('Powered by')
    expect(footer).toHaveTextContent('NEXUS')
    expect(footer).toHaveTextContent('tecnología inteligente')
  })

  it('shows the current year', () => {
    render(<SiteFooter />)
    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      String(new Date().getFullYear()),
    )
  })

  it('uses store theme variables when rendered inside a storefront', () => {
    const { container } = render(<SiteFooter tone="store" />)
    const footer = container.querySelector('footer')
    expect(footer?.className).toContain('var(--store-surface)')
    expect(footer?.className).not.toContain('bg-surface')
  })

  it('uses app tokens by default', () => {
    const { container } = render(<SiteFooter />)
    const footer = container.querySelector('footer')
    expect(footer?.className).toContain('bg-surface')
    expect(footer?.className).not.toContain('var(--store-surface)')
  })
})
