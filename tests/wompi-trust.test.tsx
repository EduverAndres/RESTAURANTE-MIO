// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PaymentMark } from '@/app/(protected)/checkout/payment-mark'
import { WompiTrust } from '@/components/payments/wompi-trust'

describe('WompiTrust', () => {
  it('shows the official Wompi logo, named for screen readers', () => {
    render(<WompiTrust />)
    const logo = screen.getByRole('img', { name: 'Wompi' })
    expect(logo.getAttribute('src')).toMatch(/\/brand\/wompi\//)
  })

  it('says who processes the payment, in words as well as in the logo', () => {
    render(<WompiTrust />)
    expect(screen.getByText(/procesad[oa]s? por Wompi/i)).toBeTruthy()
  })

  it('attributes the PCI certification to Wompi, not to the store', () => {
    const { container } = render(<WompiTrust />)
    const text = container.textContent ?? ''
    expect(text).toMatch(/PCI DSS/)
    expect(text).toMatch(/Wompi[^.]*certificada PCI DSS/)
    expect(text).toMatch(/nunca pasan por esta tienda/)
  })

  it('shows the wordmark in a fixed box, never sized from the SVG', () => {
    render(<WompiTrust />)
    const logo = screen.getByRole('img', { name: 'Wompi' })
    expect(logo.getAttribute('width')).toBe('48')
    expect(logo.getAttribute('height')).toBe('24')
  })

  it('never names the Wompi API keys or any secret', () => {
    const { container } = render(<WompiTrust />)
    expect(container.textContent).not.toMatch(/pub_|prv_|secret|llave/i)
  })
})

describe('PaymentMark for wompi', () => {
  it('renders the official contraction mark instead of a monogram', () => {
    render(<PaymentMark method="wompi" />)
    const mark = screen.getByRole('img', { name: 'Wompi' })
    expect(mark.getAttribute('src')).toMatch(/Wompi_Contraccion/)
  })

  it('keeps the in-house icons for cash and mock', () => {
    const { container: cash } = render(<PaymentMark method="cash" />)
    expect(cash.querySelector('img')).toBeNull()
    const { container: mock } = render(<PaymentMark method="mock" />)
    expect(mock.querySelector('img')).toBeNull()
  })
})
