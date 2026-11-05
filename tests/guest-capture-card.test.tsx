// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// lib/env validates the public environment at import time, which is not
// available under vitest; the card only needs the app name.
vi.mock('@/lib/env', () => ({ APP_NAME: 'Cerquita' }))

const { GuestCaptureCard } =
  await import('@/components/orders/guest-capture-card')

describe('GuestCaptureCard', () => {
  it('names the store and the platform', () => {
    render(<GuestCaptureCard storeName="Arepa & Co" storeSlug="arepa-and-co" />)
    expect(
      screen.getByRole('heading', { name: '¿Te gustó Arepa & Co?' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Crea tu cuenta en Cerquita/)).toBeInTheDocument()
  })

  it('sends both auth paths back to the storefront', () => {
    render(<GuestCaptureCard storeName="Arepa & Co" storeSlug="arepa-and-co" />)
    expect(
      screen.getByRole('link', { name: 'Crear mi cuenta' }),
    ).toHaveAttribute('href', '/register?next=%2Ft%2Farepa-and-co')
    expect(
      screen.getByRole('link', { name: 'Ya tengo cuenta' }),
    ).toHaveAttribute('href', '/login?next=%2Ft%2Farepa-and-co')
  })
})
