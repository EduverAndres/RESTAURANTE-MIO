// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react'
import { MotionConfigContext } from 'framer-motion'
import { useContext } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { CountUp } from '@/components/motion/count-up'
import { Marquee } from '@/components/motion/marquee'
import { MotionProvider } from '@/components/motion/motion-provider'
import { Reveal } from '@/components/motion/reveal'

function ReducedMotionProbe() {
  const { reducedMotion } = useContext(MotionConfigContext)
  return <p data-testid="probe">{reducedMotion}</p>
}

afterEach(() => {
  document.documentElement.removeAttribute('data-motion')
})

describe('MotionProvider', () => {
  it('follows the system setting by default', () => {
    render(
      <MotionProvider>
        <ReducedMotionProbe />
      </MotionProvider>,
    )
    expect(screen.getByTestId('probe')).toHaveTextContent('user')
  })

  it('turns Motion off when the app preference is "Reducir animaciones"', () => {
    document.documentElement.setAttribute('data-motion', 'reduce')
    render(
      <MotionProvider>
        <ReducedMotionProbe />
      </MotionProvider>,
    )
    expect(screen.getByTestId('probe')).toHaveTextContent('always')
  })

  it('follows the preference live, without a reload', async () => {
    render(
      <MotionProvider>
        <ReducedMotionProbe />
      </MotionProvider>,
    )
    act(() => document.documentElement.setAttribute('data-motion', 'reduce'))
    await waitFor(() =>
      expect(screen.getByTestId('probe')).toHaveTextContent('always'),
    )
    act(() => document.documentElement.removeAttribute('data-motion'))
    await waitFor(() =>
      expect(screen.getByTestId('probe')).toHaveTextContent('user'),
    )
  })
})

describe('CountUp', () => {
  it('renders the final value straight away and reads only that one', () => {
    const { container } = render(<CountUp value={1234} />)
    expect(container).toHaveTextContent('1.234')
    const hidden = container.querySelector('[aria-hidden="true"]')
    expect(hidden).toHaveTextContent('1.234')
    expect(container.querySelector('.sr-only')).toHaveTextContent('1.234')
  })

  it('formats pesos and averages', () => {
    const { container, rerender } = render(
      <CountUp value={18900} format="cop" />,
    )
    expect(container.querySelector('.sr-only')).toHaveTextContent('$ 18.900')
    rerender(<CountUp value={4.66} format="decimal" />)
    expect(container.querySelector('.sr-only')).toHaveTextContent('4,7')
  })
})

describe('Marquee', () => {
  it('exposes one list; the loop tail is hidden and cannot take focus', () => {
    const { container } = render(
      <Marquee label="Tipos de negocio">
        <li>
          <a href="/x">Panaderías</a>
        </li>
      </Marquee>,
    )
    expect(screen.getAllByRole('list')).toHaveLength(1)
    expect(screen.getByRole('list', { name: 'Tipos de negocio' })).toBeTruthy()
    const copy = container.querySelector('[data-marquee-copy]')
    expect(copy).toHaveAttribute('aria-hidden', 'true')
    expect(copy).toHaveAttribute('inert')
  })
})

describe('Reveal', () => {
  it('is plain markup with the reveal class, in the tag asked for', () => {
    const { container } = render(
      <Reveal as="section" className="py-4">
        Hola
      </Reveal>,
    )
    const node = container.firstElementChild
    expect(node?.tagName).toBe('SECTION')
    expect(node).toHaveClass('reveal', 'py-4')
    expect(node).not.toHaveAttribute('style')
  })
})
