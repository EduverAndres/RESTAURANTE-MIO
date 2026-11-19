// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { QrWithMark } from '@/components/dashboard/tables/qr-with-mark'

const SVG =
  '<svg data-testid="qr" viewBox="0 0 10 10"><path d="M0 0h1v1H0z"/></svg>'

describe('QrWithMark', () => {
  it('exposes the code as one labelled image', () => {
    render(<QrWithMark svg={SVG} label="Código QR de la mesa 4" />)
    const image = screen.getByRole('img', { name: 'Código QR de la mesa 4' })
    expect(image.querySelector('[data-testid="qr"]')).not.toBeNull()
  })

  it('keeps the platform mark out of the accessibility tree', () => {
    const { container } = render(
      <QrWithMark svg={SVG} label="Código QR de la mesa 4" />,
    )
    // One accessible image only: the mark is decoration on top of the code.
    expect(screen.getAllByRole('img')).toHaveLength(1)
    const marks = container.querySelectorAll('[data-slot="brand-mark"]')
    expect(marks).toHaveLength(1)
    expect(marks[0].getAttribute('aria-hidden')).toBe('true')
  })
})
