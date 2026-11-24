import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RequestStatusCard } from '@/app/(public)/t/[slug]/reservar/request-status-card'
import { requestStatusCopy } from '@/lib/reservations/request-status'

const live = vi.hoisted(() => ({
  broadcast: null as null | {
    topic: string
    onMessage?: (payload: Record<string, unknown>) => void
    onResync?: () => void
  },
  changes: null as null | {
    filter?: string
    onEvent?: (payload: unknown) => void
  },
  row: null as null | Record<string, unknown>,
  reads: 0,
}))

vi.mock('@/components/providers/realtime-provider', () => ({
  useBroadcastChannel: (options: typeof live.broadcast) => {
    live.broadcast = options
  },
  useRealtimeChannel: (options: typeof live.changes) => {
    live.changes = options
  },
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            live.reads += 1
            return { data: live.row, error: null }
          },
        }),
      }),
    }),
  }),
}))

const input = {
  storeName: 'Sushi Nocturno',
  when: 'mié, 25 nov, 7:30 p. m.',
  party: '2 personas',
  reason: null,
  cancelledBy: null,
}

describe('requestStatusCopy', () => {
  it('ends the sentence after "p. m." without a second period', () => {
    const { title, body } = requestStatusCopy('pending', input)
    expect(title).toBe('Solicitud enviada')
    expect(body).toBe(
      'Sushi Nocturno confirmará tu mesa para 2 personas el mié, 25 nov, 7:30 p. m. Te avisamos apenas responda.',
    )
    expect(body).not.toContain('..')
  })

  it('keeps the calendar while the booking stands', () => {
    const confirmed = requestStatusCopy('confirmed', input)
    expect(confirmed.title).toBe('¡Mesa confirmada!')
    expect(confirmed.body).toBe(
      'Sushi Nocturno te espera el mié, 25 nov, 7:30 p. m. Mesa para 2 personas.',
    )
    expect(confirmed).toMatchObject({
      tone: 'success',
      showCalendar: true,
      canRebook: false,
    })
  })

  it('gives the store’s reason and a way back when it says no', () => {
    const declined = requestStatusCopy('declined', {
      ...input,
      reason: 'No hay mesas para esa hora',
    })
    expect(declined.body).toBe(
      'Sushi Nocturno no pudo confirmar tu mesa del mié, 25 nov, 7:30 p. m. Motivo: No hay mesas para esa hora.',
    )
    const cancelled = requestStatusCopy('cancelled', {
      ...input,
      reason: 'Cierre por mantenimiento',
      cancelledBy: 'store',
    })
    expect(cancelled.title).toBe('Reserva cancelada')
    expect(cancelled.body).toBe(
      'Sushi Nocturno canceló tu mesa del mié, 25 nov, 7:30 p. m. Motivo: Cierre por mantenimiento.',
    )
    for (const copy of [declined, cancelled]) {
      expect(copy).toMatchObject({
        tone: 'danger',
        showCalendar: false,
        canRebook: true,
      })
    }
  })

  it('tells a customer who cancelled elsewhere that it was them', () => {
    const copy = requestStatusCopy('cancelled', {
      ...input,
      reason: 'ignored',
      cancelledBy: 'customer',
    })
    expect(copy.body).toBe('Cancelaste tu mesa del mié, 25 nov, 7:30 p. m.')
  })
})

describe('RequestStatusCard', () => {
  const onRebook = vi.fn()

  function renderCard() {
    return render(
      <RequestStatusCard
        reservation={{ id: 'res-1', code: 'E6DC65' }}
        userId="user-1"
        store={{ name: 'Sushi Nocturno', address: 'Carrera 55 # 96-85' }}
        party={2}
        startsAt="2026-11-26T00:30:00.000Z"
        durationMinutes={90}
        headingRef={createRef()}
        onRebook={onRebook}
      />,
    )
  }

  beforeEach(() => {
    live.broadcast = null
    live.changes = null
    live.row = null
    live.reads = 0
    onRebook.mockReset()
  })

  it('starts as a sent request, listening on the customer’s own topic', () => {
    renderCard()
    expect(
      screen.getByRole('heading', { name: 'Solicitud enviada' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/7:30 p\. m\. Te avisamos/)).toBeInTheDocument()
    expect(live.broadcast?.topic).toBe('user:user-1')
    expect(live.changes?.filter).toBe('customer_id=eq.user-1')
    expect(
      screen.getByRole('link', { name: /Agregar al calendario/ }),
    ).toBeInTheDocument()
  })

  it('turns into a cancellation, with the reason, as soon as the store cancels', async () => {
    renderCard()
    live.row = {
      status: 'cancelled',
      decline_reason: null,
      cancel_reason: 'Cierre por mantenimiento',
      cancelled_by: 'store',
    }
    act(() => live.broadcast?.onMessage?.({ kind: 'reservation_updated' }))

    expect(
      await screen.findByRole('heading', { name: 'Reserva cancelada' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Motivo: Cierre por mantenimiento\./),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /Agregar al calendario/ }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Elegir otra hora' }))
    expect(onRebook).toHaveBeenCalledTimes(1)
  })

  it('confirms from the row change when the message never came', async () => {
    renderCard()
    live.row = {
      status: 'confirmed',
      decline_reason: null,
      cancel_reason: null,
      cancelled_by: null,
    }
    act(() => live.changes?.onEvent?.({}))

    expect(
      await screen.findByRole('heading', { name: '¡Mesa confirmada!' }),
    ).toBeInTheDocument()
  })

  it('ignores notifications about anything else', async () => {
    renderCard()
    act(() => live.broadcast?.onMessage?.({ kind: 'ad_campaign_reviewed' }))
    await waitFor(() => expect(live.reads).toBe(0))
    expect(
      screen.getByRole('heading', { name: 'Solicitud enviada' }),
    ).toBeInTheDocument()
  })
})
