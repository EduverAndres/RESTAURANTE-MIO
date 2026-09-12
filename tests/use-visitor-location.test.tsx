import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useVisitorLocation } from '@/hooks/use-visitor-location'
import { GeolocationFailureError } from '@/lib/geo/geolocation-availability'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

type PositionErrorCallback = (error: { code: number; message: string }) => void
type PositionCallback = (position: {
  coords: { latitude: number; longitude: number }
}) => void

function stubGeolocation(
  impl: (success: PositionCallback, error: PositionErrorCallback) => void,
) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: vi.fn(impl) },
  })
}

function stubSecureContext(value: boolean) {
  Object.defineProperty(window, 'isSecureContext', {
    configurable: true,
    value,
  })
}

async function expectReason(
  promise: Promise<unknown>,
  reason: GeolocationFailureError['reason'],
) {
  const error = await promise.catch((caught: unknown) => caught)
  expect(error).toBeInstanceOf(GeolocationFailureError)
  expect((error as GeolocationFailureError).reason).toBe(reason)
}

describe('useVisitorLocation', () => {
  const originalGeolocation = Object.getOwnPropertyDescriptor(
    navigator,
    'geolocation',
  )
  const originalSecureContext = Object.getOwnPropertyDescriptor(
    window,
    'isSecureContext',
  )

  beforeEach(() => {
    stubSecureContext(true)
  })

  afterEach(() => {
    if (originalGeolocation)
      Object.defineProperty(navigator, 'geolocation', originalGeolocation)
    else Reflect.deleteProperty(navigator, 'geolocation')
    if (originalSecureContext)
      Object.defineProperty(window, 'isSecureContext', originalSecureContext)
    else Reflect.deleteProperty(window, 'isSecureContext')
  })

  it('rejects with insecure on a plain http origin', async () => {
    stubSecureContext(false)
    stubGeolocation(() => {
      throw new Error('should not be called')
    })
    const { result } = renderHook(() => useVisitorLocation())

    await expectReason(result.current.locate(), 'insecure')
    await waitFor(() => expect(result.current.gpsSupport).toBe('insecure'))
  })

  it('rejects with unsupported when navigator has no geolocation', async () => {
    Reflect.deleteProperty(navigator, 'geolocation')
    const { result } = renderHook(() => useVisitorLocation())

    await expectReason(result.current.locate(), 'unsupported')
    await waitFor(() => expect(result.current.gpsSupport).toBe('unsupported'))
  })

  it('rejects with denied when the browser reports code 1', async () => {
    stubGeolocation((_success, error) =>
      error({ code: 1, message: 'User denied Geolocation' }),
    )
    const { result } = renderHook(() => useVisitorLocation())

    await expectReason(result.current.locate(), 'denied')
  })

  it('resolves with the device coordinates', async () => {
    stubGeolocation((success) =>
      success({ coords: { latitude: 4.65, longitude: -74.08 } }),
    )
    const { result } = renderHook(() => useVisitorLocation())

    await expect(result.current.locate()).resolves.toEqual({
      lat: 4.65,
      lng: -74.08,
    })
    await waitFor(() => expect(result.current.gpsSupport).toBe('ok'))
  })
})
