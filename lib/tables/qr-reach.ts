// Pure helpers behind `tableQrBase`: which network address a phone can reach
// and whether a QR origin is usable at all. No Node or Next imports, so they
// are unit-tested directly.

export interface QrBase {
  /** Scheme + host[:port], no trailing slash. */
  origin: string
  /** False when a phone scanning the code would not reach this origin. */
  reachable: boolean
  /** Why it is not reachable, in words for the merchant. */
  warning?: string
}

export interface InterfaceAddress {
  name: string
  address: string
  family: string | number
  internal: boolean
}

/** Adapters a phone on the same Wi-Fi can never reach. */
const VIRTUAL_ADAPTER =
  /vethernet|virtualbox|vmware|hyper-v|docker|wsl|tailscale|zerotier|hamachi|vpn|loopback|utun|bridge|vboxnet/i
const PREFERRED_ADAPTER = /wi-?fi|wlan|wireless|ethernet|^en\d|^eth\d/i

function isIpv4(entry: InterfaceAddress): boolean {
  return entry.family === 'IPv4' || entry.family === 4
}

/**
 * The address of this machine that a phone on the same network can open:
 * IPv4, not loopback, not link-local (169.254.x.x — an adapter that never got
 * a network), not a virtual adapter. Physical Wi-Fi/Ethernet first.
 */
export function pickLanAddress(
  entries: readonly InterfaceAddress[],
): string | null {
  const candidates = entries.filter(
    (entry) =>
      isIpv4(entry) &&
      !entry.internal &&
      !entry.address.startsWith('169.254.') &&
      !entry.address.startsWith('127.') &&
      !VIRTUAL_ADAPTER.test(entry.name),
  )
  const preferred = candidates.find((entry) =>
    PREFERRED_ADAPTER.test(entry.name),
  )
  return (preferred ?? candidates[0])?.address ?? null
}

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '[::1]' ||
    hostname.startsWith('127.') ||
    hostname === '0.0.0.0'
  )
}

export function qrBaseFor({
  origin,
  lanAddress,
  production,
}: {
  origin: string
  lanAddress: string | null
  production: boolean
}): QrBase {
  const url = new URL(origin)
  const clean = url.origin

  if (!isLoopbackHost(url.hostname)) {
    if (production && url.protocol !== 'https:') {
      return {
        origin: clean,
        reachable: true,
        warning:
          'Tu sitio no usa HTTPS: algunos celulares advierten que el enlace no es seguro. Configura un certificado SSL en tu dominio.',
      }
    }
    return { origin: clean, reachable: true }
  }

  if (production) {
    return {
      origin: clean,
      reachable: false,
      warning:
        'NEXT_PUBLIC_SITE_URL apunta a localhost. Configúrala con el dominio público del sitio antes de imprimir los QR.',
    }
  }

  if (lanAddress) {
    url.hostname = lanAddress
    return {
      origin: url.origin,
      reachable: true,
      warning: `Modo desarrollo: los QR apuntan a la IP de este equipo (${lanAddress}). Funcionan desde un celular conectado a la misma red; no los imprimas, en producción usarán tu dominio.`,
    }
  }

  return {
    origin: clean,
    reachable: false,
    warning:
      'Estos QR apuntan a localhost y un celular no puede abrirlos. Conecta este equipo a una red Wi-Fi o Ethernet, o usa el dominio publicado.',
  }
}
