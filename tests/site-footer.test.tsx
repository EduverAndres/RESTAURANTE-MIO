// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
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

  it('groups the way forward by audience', () => {
    render(<SiteFooter />)
    const href = (nav: string, name: string) =>
      within(screen.getByRole('navigation', { name: nav }))
        .getByRole('link', { name })
        .getAttribute('href')

    expect(href('Clientes', 'Explorar')).toBe('/#restaurantes')
    expect(href('Clientes', 'Reservar mesa')).toBe('/reservas')
    expect(href('Clientes', 'Mis pedidos')).toBe('/account#pedidos')
    expect(href('Empresas', 'Cuenta empresarial')).toBe('/empresas')
    expect(href('Negocios', 'Vende con Tienda')).toBe('/para-restaurantes')
    expect(href('Negocios', 'Planes')).toBe('/para-restaurantes#planes')
    expect(href('Negocios', 'Publicidad')).toBe('/para-restaurantes#destacados')
    expect(href('Trabaja con nosotros', 'Domiciliarios')).toBe('/repartidores')
  })

  it('keeps the storefront footer to the credit, without the audience columns', () => {
    render(<SiteFooter tone="store" />)
    expect(screen.queryByRole('navigation', { name: 'Clientes' })).toBeNull()
  })

  it('uses app tokens by default', () => {
    const { container } = render(<SiteFooter />)
    const footer = container.querySelector('footer')
    expect(footer?.className).toContain('bg-surface')
    expect(footer?.className).not.toContain('var(--store-surface)')
  })
})
