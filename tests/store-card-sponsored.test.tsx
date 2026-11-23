// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { StoreCardData } from '@/components/store/store-card'

// The favourite button reaches a server action; the card is what is tested.
vi.mock('@/components/store/favorite-button', () => ({
  FavoriteButton: () => null,
}))
vi.mock('next/image', () => ({
  default: (props: { alt: string }) => <span data-alt={props.alt} />,
}))

const { StoreCard } = await import('@/components/store/store-card')

const STORE: StoreCardData = {
  id: 'store-1',
  slug: 'arepa-and-co',
  name: 'Arepa & Co',
  category: 'Comida rápida',
  cover_url: null,
  logo_url: null,
  rating_avg: 4.6,
  rating_count: 12,
  prep_time_min: 20,
  delivery_fee: 3000,
  is_open: true,
}

describe('StoreCard', () => {
  it('links straight to the store and says nothing about sponsorship', () => {
    render(<StoreCard store={STORE} />)
    const link = screen.getByRole('link', { name: 'Ver Arepa & Co' })
    expect(link).toHaveAttribute('href', '/t/arepa-and-co')
    expect(link).not.toHaveAttribute('rel')
    expect(screen.queryByText('Patrocinado')).not.toBeInTheDocument()
  })

  it('shows a visible "Patrocinado" label when a campaign pays for the place', () => {
    render(
      <StoreCard store={{ ...STORE, sponsoredCampaignId: 'campaign-9' }} />,
    )
    // Visible text, not only an accessible name (Ley 1480).
    const label = screen.getByText('Patrocinado')
    expect(label).toBeVisible()
    expect(label.closest('[aria-hidden="true"]')).toBeNull()
  })

  it('links a sponsored card through the click counter, as sponsored', () => {
    render(
      <StoreCard store={{ ...STORE, sponsoredCampaignId: 'campaign-9' }} />,
    )
    const link = screen.getByRole('link', {
      name: 'Ver Arepa & Co (patrocinado)',
    })
    expect(link).toHaveAttribute('href', '/api/ads/click/campaign-9')
    expect(link).toHaveAttribute('rel', 'sponsored')
    expect(within(link).getByText('Patrocinado')).toBeInTheDocument()
  })

  it('keeps the label on a closed store too', () => {
    render(
      <StoreCard
        store={{ ...STORE, is_open: false, sponsoredCampaignId: 'campaign-9' }}
      />,
    )
    expect(screen.getByText('Patrocinado')).toBeInTheDocument()
    expect(screen.getByText('Cerrado ahora')).toBeInTheDocument()
  })
})
