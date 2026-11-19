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

/** No usable GPS for this person: the device has none, or they said no. */
export const NO_GPS_MESSAGE =
  'No tienes acceso a GPS en este dispositivo. Te recomendamos hacer la compra desde un dispositivo con GPS, o busca tu dirección manualmente.'

/**
 * The device may well have GPS: it is the connection. Browsers only allow
 * geolocation on secure (https) origins, so on plain http the request is
 * refused before the phone is ever asked. Telling this person "your device
 * has no GPS" would be false, so they get the honest reason instead.
 */
export const INSECURE_GPS_MESSAGE =
  'La ubicación automática no está disponible en esta conexión porque el sitio todavía no usa una conexión segura. Busca tu dirección manualmente o marca el punto en el mapa.'

const FAILURE_MESSAGES: Record<GeolocationFailure, string> = {
  unsupported: NO_GPS_MESSAGE,
  insecure: INSECURE_GPS_MESSAGE,
  // Same copy as "no GPS": from where the person stands, location is not
  // available on this device, and the way forward is the manual search.
  denied: NO_GPS_MESSAGE,
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
