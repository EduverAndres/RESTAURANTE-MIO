// Pure helpers describing why the Geolocation API cannot be used. They take
// plain inputs instead of touching `window` so they run on the server and in
// tests, and every consumer (customer picker, address form, courier
// publisher) classifies failures the same way.

export type GeolocationSupport = 'ok' | 'unsupported' | 'insecure'

export type GeolocationFailure =
  'unsupported' | 'insecure' | 'denied' | 'unavailable' | 'timeout'

export interface GeolocationHost {
  /** Undefined on very old browsers; treated as secure. */
  isSecureContext?: boolean
  navigator: { geolocation?: unknown }
}

/**
 * Browsers only expose a working Geolocation API on secure contexts, so a
 * phone opening `http://192.168.x.x` sees `navigator.geolocation` but every
 * request fails. Detecting that up front lets the UI explain it instead of
 * blaming permissions.
 */
export function detectGeolocationSupport(
  host: GeolocationHost,
): GeolocationSupport {
  if (!host.navigator.geolocation) return 'unsupported'
  if (host.isSecureContext === false) return 'insecure'
  return 'ok'
}

const PERMISSION_DENIED = 1
const POSITION_UNAVAILABLE = 2
const TIMEOUT = 3

/** Maps a `GeolocationPositionError.code` to a failure reason. */
export function classifyPositionError(code: number): GeolocationFailure {
  switch (code) {
    case PERMISSION_DENIED:
      return 'denied'
    case TIMEOUT:
      return 'timeout'
    case POSITION_UNAVAILABLE:
    default:
      return 'unavailable'
  }
}

const NO_GPS_MESSAGE =
  'No tienes acceso a GPS en este dispositivo. Te recomendamos hacer la compra desde un dispositivo con GPS, o busca tu dirección manualmente.'

const FAILURE_MESSAGES: Record<GeolocationFailure, string> = {
  unsupported: NO_GPS_MESSAGE,
  insecure: NO_GPS_MESSAGE,
  denied:
    'El permiso de ubicación está bloqueado. Actívalo en tu navegador o busca tu dirección manualmente.',
  unavailable:
    'No pudimos obtener tu ubicación. Intenta de nuevo o busca tu dirección manualmente.',
  timeout:
    'La ubicación tardó demasiado. Intenta de nuevo o busca tu dirección manualmente.',
}

export function geolocationFailureMessage(reason: GeolocationFailure): string {
  return FAILURE_MESSAGES[reason]
}

export class GeolocationFailureError extends Error {
  readonly reason: GeolocationFailure

  constructor(reason: GeolocationFailure) {
    super(geolocationFailureMessage(reason))
    this.name = 'GeolocationFailureError'
    this.reason = reason
  }
}
