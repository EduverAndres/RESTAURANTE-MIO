// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/webhooks/wompi/route'
import { eventChecksum, type WompiEvent } from '@/lib/payments/wompi/signature'
import { handleWompiEvent } from '@/lib/payments/wompi/webhook'

const state = vi.hoisted(() => ({
  env: {
    WOMPI_PUBLIC_KEY: 'pub_test_key',
    WOMPI_PRIVATE_KEY: 'prv_test_key',
    WOMPI_EVENTS_SECRET: 'events-secret' as string | undefined,
    WOMPI_INTEGRITY_SECRET: 'integrity-secret',
  },
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env.server', () => ({
  serverEnv: state.env,
  wompiConfigured: () =>
    Boolean(
      state.env.WOMPI_PUBLIC_KEY &&
        state.env.WOMPI_PRIVATE_KEY &&
        state.env.WOMPI_EVENTS_SECRET &&
        state.env.WOMPI_INTEGRITY_SECRET,
    ),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
vi.mock('@/lib/payments/wompi/webhook', () => ({ handleWompiEvent: vi.fn() }))

const handle = vi.mocked(handleWompiEvent)
const SECRET = 'events-secret'

function signedEvent(secret: string): WompiEvent {
  const data = {
    transaction: {
      id: 'tx_1',
      status: 'APPROVED',
      reference: 'ord_11111111-1111-4111-8111-111111111111',
      amount_in_cents: 4900000,
    },
  }
  const properties = [
    'transaction.id',
    'transaction.status',
    'transaction.amount_in_cents',
  ]
  const timestamp = 1700000000
  return {
    event: 'transaction.updated',
    environment: 'test',
    timestamp,
    sent_at: '2026-09-12T00:00:00.000Z',
    data,
    signature: {
      properties,
      checksum: eventChecksum({ properties, data, timestamp, secret }),
    },
  }
}

function post(body: string): Promise<Response> {
  return POST(
    new Request('http://localhost/api/webhooks/wompi', { method: 'POST', body }),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  handle.mockReset()
  state.env.WOMPI_EVENTS_SECRET = SECRET
})

describe('POST /api/webhooks/wompi', () => {
  it('responds 503 when the events secret is missing', async () => {
    state.env.WOMPI_EVENTS_SECRET = undefined
    const response = await post(JSON.stringify(signedEvent(SECRET)))
    expect(response.status).toBe(503)
    expect(handle).not.toHaveBeenCalled()
  })

  it('responds 400 on a body that is not JSON', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await post('{not json')
    expect(response.status).toBe(400)
    expect(handle).not.toHaveBeenCalled()
  })

  it('responds 401 on a checksum mismatch without reaching the handler', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await post(JSON.stringify(signedEvent('another-secret')))
    expect(response.status).toBe(401)
    expect(handle).not.toHaveBeenCalled()
  })

  it('responds 200 once a valid event is applied', async () => {
    handle.mockResolvedValue({
      outcome: 'applied',
      paymentStatus: 'paid',
      reopened: false,
    })
    const response = await post(JSON.stringify(signedEvent(SECRET)))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(handle).toHaveBeenCalledTimes(1)
  })

  it.each(['order_not_found', 'amount_mismatch', 'duplicate', 'ignored'] as const)(
    'responds 200 on %s so Wompi stops retrying',
    async (outcome) => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      handle.mockResolvedValue({ outcome })
      const response = await post(JSON.stringify(signedEvent(SECRET)))
      expect(response.status).toBe(200)
    },
  )

  it('responds 500 when the event could not be stored so Wompi retries', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    handle.mockResolvedValue({ outcome: 'store_failed' })
    const response = await post(JSON.stringify(signedEvent(SECRET)))
    expect(response.status).toBe(500)
  })

  it('responds 500 when the order could not be updated so Wompi retries', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    handle.mockResolvedValue({ outcome: 'apply_failed' })
    const response = await post(JSON.stringify(signedEvent(SECRET)))
    expect(response.status).toBe(500)
  })

  it('responds 500 when the handler throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    handle.mockRejectedValue(new Error('boom'))
    const response = await post(JSON.stringify(signedEvent(SECRET)))
    expect(response.status).toBe(500)
  })
})
