// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CHECKOUT_TTL_MS,
  WOMPI_REQUEST_TIMEOUT_MS,
  fetchWompiTransaction,
  wompiProvider,
} from '@/lib/payments/wompi/provider'
import { integritySignature } from '@/lib/payments/wompi/signature'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env.server', () => ({
  serverEnv: {
    WOMPI_PUBLIC_KEY: 'pub_test_key',
    WOMPI_PRIVATE_KEY: 'prv_test_key',
    WOMPI_EVENTS_SECRET: 'events-secret',
    WOMPI_INTEGRITY_SECRET: 'integrity-secret',
  },
  wompiConfigured: () => true,
}))

const TRANSACTION = {
  id: 'tx_1',
  status: 'APPROVED',
  reference: 'ord_1',
  amount_in_cents: 4900000,
  currency: 'COP',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('fetchWompiTransaction', () => {
  it('parses the transaction from a successful sandbox lookup', async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = []
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init })
      return jsonResponse({ data: TRANSACTION })
    }

    const data = await fetchWompiTransaction('tx_1', fetchImpl)

    expect(data).toEqual(TRANSACTION)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('https://sandbox.wompi.co/v1/transactions/tx_1')
    expect(calls[0]?.init?.headers).toEqual({
      Authorization: 'Bearer prv_test_key',
    })
    expect(calls[0]?.init?.signal).toBeInstanceOf(AbortSignal)
  })

  it('returns null and logs on a non-200 response', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchImpl: typeof fetch = async () =>
      jsonResponse({ error: 'not found' }, 404)

    await expect(fetchWompiTransaction('tx_1', fetchImpl)).resolves.toBeNull()
    const record = JSON.parse(log.mock.calls[0]?.[0] as string) as {
      event: string
      context?: Record<string, unknown>
    }
    expect(record.event).toBe('wompi.provider.lookup_failed')
    expect(record.context).toMatchObject({ httpStatus: 404 })
  })

  it('aborts after the timeout and returns null', async () => {
    vi.useFakeTimers()
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    let signal: AbortSignal | null | undefined
    const fetchImpl: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        signal = init?.signal
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('The operation was aborted.', 'AbortError')),
        )
      })

    const pending = fetchWompiTransaction('tx_1', fetchImpl)
    await vi.advanceTimersByTimeAsync(WOMPI_REQUEST_TIMEOUT_MS)

    await expect(pending).resolves.toBeNull()
    expect(signal?.aborted).toBe(true)
    expect(log).toHaveBeenCalled()
  })

  it('returns null when the request rejects for any other reason', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchImpl: typeof fetch = async () => {
      throw new TypeError('fetch failed')
    }
    await expect(fetchWompiTransaction('tx_1', fetchImpl)).resolves.toBeNull()
  })
})

describe('wompiProvider.createPayment', () => {
  it('signs and passes a 30 minute expiration time to the checkout', async () => {
    vi.useFakeTimers()
    const now = new Date('2026-09-12T10:00:00.000Z')
    vi.setSystemTime(now)
    const expirationTime = new Date(now.getTime() + CHECKOUT_TTL_MS).toISOString()

    const result = await wompiProvider.createPayment({
      orderId: '11111111-1111-4111-8111-111111111111',
      shortCode: 'A1B2',
      amount: 49000,
      currency: 'COP',
      customer: { id: 'u1', email: 'ana@example.com', name: 'Ana' },
      returnUrl: 'https://tienda.app/orders/1',
    })

    expect(result.status).toBe('pending')
    expect(result.redirectUrl).toBeDefined()
    const params = new URL(result.redirectUrl as string).searchParams
    expect(expirationTime).toBe('2026-09-12T10:30:00.000Z')
    expect(params.get('expiration-time')).toBe(expirationTime)
    expect(params.get('signature:integrity')).toBe(
      integritySignature({
        reference: 'ord_11111111-1111-4111-8111-111111111111',
        amountInCents: 4900000,
        currency: 'COP',
        expirationTime,
        secret: 'integrity-secret',
      }),
    )
  })
})
