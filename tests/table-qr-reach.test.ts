import { describe, expect, it } from 'vitest'
import { tableEntryUrl } from '@/lib/tables/qr'
import { pickLanAddress, qrBaseFor } from '@/lib/tables/qr-reach'

const iface = (name: string, address: string, internal = false) => ({
  name,
  address,
  family: 'IPv4',
  internal,
})

describe('pickLanAddress', () => {
  it('prefers the Wi-Fi card over link-local, virtual and VPN adapters', () => {
    expect(
      pickLanAddress([
        iface('Tailscale', '169.254.83.107'),
        iface('vEthernet (Default Switch)', '172.29.192.1'),
        iface('Wi-Fi', '200.100.20.115'),
        iface('Ethernet', '169.254.100.90'),
        iface('Loopback Pseudo-Interface 1', '127.0.0.1', true),
      ]),
    ).toBe('200.100.20.115')
  })

  it('returns null when nothing a phone could reach exists', () => {
    expect(
      pickLanAddress([
        iface('Ethernet', '169.254.1.2'),
        iface('lo', '127.0.0.1', true),
      ]),
    ).toBeNull()
  })
})

describe('qrBaseFor', () => {
  it('swaps localhost for the LAN address in development, keeping the port', () => {
    const base = qrBaseFor({
      origin: 'http://localhost:3000',
      lanAddress: '192.168.1.20',
      production: false,
    })
    expect(base.origin).toBe('http://192.168.1.20:3000')
    expect(base.reachable).toBe(true)
  })

  it('flags localhost as unreachable when there is no network', () => {
    expect(
      qrBaseFor({
        origin: 'http://localhost:3000',
        lanAddress: null,
        production: false,
      }).reachable,
    ).toBe(false)
  })

  it('refuses a production build still pointing at localhost', () => {
    const base = qrBaseFor({
      origin: 'http://localhost:3000',
      lanAddress: null,
      production: true,
    })
    expect(base.reachable).toBe(false)
    expect(base.warning).toMatch(/NEXT_PUBLIC_SITE_URL/)
  })

  it('uses a real domain as is', () => {
    expect(
      qrBaseFor({
        origin: 'https://tienda.co/',
        lanAddress: null,
        production: true,
      }),
    ).toEqual({ origin: 'https://tienda.co', reachable: true })
  })

  it('prints the path form, which works without wildcard DNS', () => {
    expect(
      tableEntryUrl('https://tienda.co', 'arepa-and-co', 'a'.repeat(24)),
    ).toBe(`https://tienda.co/t/arepa-and-co/mesa/${'a'.repeat(24)}`)
  })
})
