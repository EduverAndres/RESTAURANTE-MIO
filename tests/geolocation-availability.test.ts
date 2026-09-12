import { describe, expect, it } from 'vitest'
import {
  classifyPositionError,
  detectGeolocationSupport,
  GeolocationFailureError,
  geolocationFailureMessage,
} from '@/lib/geo/geolocation-availability'

describe('detectGeolocationSupport', () => {
  it('returns ok on a secure context with the Geolocation API', () => {
    expect(
      detectGeolocationSupport({
        isSecureContext: true,
        navigator: { geolocation: {} },
      }),
    ).toBe('ok')
  })

  it('returns unsupported when the browser exposes no geolocation', () => {
    expect(
      detectGeolocationSupport({ isSecureContext: true, navigator: {} }),
    ).toBe('unsupported')
  })

  it('returns insecure on plain http even when geolocation exists', () => {
    expect(
      detectGeolocationSupport({
        isSecureContext: false,
        navigator: { geolocation: {} },
      }),
    ).toBe('insecure')
  })

  it('reports unsupported before insecure when both apply', () => {
    expect(
      detectGeolocationSupport({ isSecureContext: false, navigator: {} }),
    ).toBe('unsupported')
  })

  it('treats a missing isSecureContext as secure (legacy browsers)', () => {
    expect(detectGeolocationSupport({ navigator: { geolocation: {} } })).toBe(
      'ok',
    )
  })
})

describe('classifyPositionError', () => {
  it('maps the GeolocationPositionError codes', () => {
    expect(classifyPositionError(1)).toBe('denied')
    expect(classifyPositionError(2)).toBe('unavailable')
    expect(classifyPositionError(3)).toBe('timeout')
  })

  it('falls back to unavailable for unknown codes', () => {
    expect(classifyPositionError(0)).toBe('unavailable')
    expect(classifyPositionError(99)).toBe('unavailable')
  })
})

describe('geolocationFailureMessage', () => {
  it('uses the same no-GPS copy for unsupported and insecure', () => {
    const expected =
      'No tienes acceso a GPS en este dispositivo. Te recomendamos hacer la compra desde un dispositivo con GPS, o busca tu dirección manualmente.'
    expect(geolocationFailureMessage('unsupported')).toBe(expected)
    expect(geolocationFailureMessage('insecure')).toBe(expected)
  })

  it('explains a blocked permission', () => {
    expect(geolocationFailureMessage('denied')).toBe(
      'El permiso de ubicación está bloqueado. Actívalo en tu navegador o busca tu dirección manualmente.',
    )
  })

  it('explains an unavailable position', () => {
    expect(geolocationFailureMessage('unavailable')).toBe(
      'No pudimos obtener tu ubicación. Intenta de nuevo o busca tu dirección manualmente.',
    )
  })

  it('explains a timeout', () => {
    expect(geolocationFailureMessage('timeout')).toBe(
      'La ubicación tardó demasiado. Intenta de nuevo o busca tu dirección manualmente.',
    )
  })
})

describe('GeolocationFailureError', () => {
  it('carries the reason and the matching message', () => {
    const error = new GeolocationFailureError('denied')
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('GeolocationFailureError')
    expect(error.reason).toBe('denied')
    expect(error.message).toBe(geolocationFailureMessage('denied'))
  })
})
