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
  })

  it('gives admins the brand alone: no line, no scene', () => {
    expect(welcomeFor('admin')).toEqual({ phrase: null, scene: false })
  })

  it('treats an unknown or missing role as a customer', () => {
    expect(welcomeFor(null).phrase).toBe(WELCOME_PHRASES.customer)
    expect(welcomeFor('superuser').phrase).toBe(WELCOME_PHRASES.customer)
  })
})

describe('WelcomeOverlay', () => {
  it.each([
    ['customer', 'Lo que te gusta, a minutos.'],
    ['merchant', 'Tu cocina, en el mapa de tu barrio.'],
    ['courier', 'Listo para salir a ruta.'],
  ] as const)(
    'shows the %s line with the brand and the scene',
    (role, line) => {
      const { container } = render(<WelcomeOverlay role={role} />)
      const status = screen.getByRole('status')
      expect(status).toHaveTextContent('Cerquita.')
      expect(status).toHaveTextContent(line)
      expect(status).toHaveAttribute('data-role', role)
      expect(container.querySelector('svg')).not.toBeNull()
    },
  )

  it('shows only the brand to an admin', () => {
    const { container } = render(<WelcomeOverlay role="admin" />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(/^Cerquita\.$/)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('fades out when leaving', () => {
    render(<WelcomeOverlay role="customer" leaving />)
    expect(screen.getByRole('status').className).toMatch(/animate-success-out/)
  })
})
