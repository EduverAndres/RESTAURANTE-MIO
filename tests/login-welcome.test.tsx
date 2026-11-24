import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WelcomeOverlay } from '@/components/auth/login-success'
import { WELCOME_PHRASES, welcomeFor } from '@/lib/auth/welcome'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/lib/env', () => ({ APP_NAME: 'Cerquita' }))

describe('welcomeFor', () => {
  it('speaks to each role with its own line', () => {
    expect(welcomeFor('customer').phrase).toBe('Lo que te gusta, a minutos.')
    expect(welcomeFor('merchant').phrase).toBe(
      'Tu cocina, en el mapa de tu barrio.',
    )
    expect(welcomeFor('courier').phrase).toBe('Listo para salir a ruta.')
    expect(welcomeFor('admin').phrase).toBe('La plataforma, de un vistazo.')
  })

  it('plays a scene for each role', () => {
    expect(welcomeFor('customer').scene).toBe('route-pin')
    expect(welcomeFor('courier').scene).toBe('route-pin')
    // The customer's scene the other way round: the store sends it home.
    expect(welcomeFor('merchant').scene).toBe('store-to-home')
    expect(welcomeFor('admin').scene).toBe('dashboard')
  })

  it('treats an unknown or missing role as a customer', () => {
    expect(welcomeFor(null)).toEqual(welcomeFor('customer'))
    expect(welcomeFor('superuser').phrase).toBe(WELCOME_PHRASES.customer)
  })
})

describe('WelcomeOverlay', () => {
  it.each([
    ['customer', 'Lo que te gusta, a minutos.', 'route-pin'],
    ['merchant', 'Tu cocina, en el mapa de tu barrio.', 'store-to-home'],
    ['courier', 'Listo para salir a ruta.', 'route-pin'],
    ['admin', 'La plataforma, de un vistazo.', 'dashboard'],
  ] as const)(
    'shows the %s line with the brand and its scene',
    (role, line, scene) => {
      const { container } = render(<WelcomeOverlay role={role} />)
      const status = screen.getByRole('status')
      expect(status).toHaveTextContent('Cerquita.')
      expect(status).toHaveTextContent(line)
      expect(status).toHaveAttribute('data-role', role)
      expect(status).toHaveAttribute('data-scene', scene)
      const svg = container.querySelector('svg')
      expect(svg).not.toBeNull()
      expect(svg).toHaveAttribute('aria-hidden', 'true')
    },
  )

  it('draws the merchant route from the store to the home', () => {
    const { container } = render(<WelcomeOverlay role="merchant" />)
    // The store (origin) appears first; the home pops in on arrival.
    expect(container.querySelector('.animate-welcome-dot')).not.toBeNull()
    expect(container.querySelector('.animate-welcome-arrive')).not.toBeNull()
    expect(container.querySelector('.animate-welcome-pin')).toBeNull()
  })

  it('fades out when leaving', () => {
    render(<WelcomeOverlay role="customer" leaving />)
    expect(screen.getByRole('status').className).toMatch(/animate-success-out/)
  })
})
