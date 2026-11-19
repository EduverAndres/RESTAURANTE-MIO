import { describe, expect, it } from 'vitest'
import { describeHowToPay } from '@/lib/payments/summary'

describe('describeHowToPay', () => {
  it('names cash and the Wompi methods when both are on', () => {
    expect(describeHowToPay(['cash', 'wompi'])).toBe(
      'Pagas en efectivo al recibir o en línea con tarjeta, PSE o Nequi.',
    )
  })

  it('prefers the Wompi wording when Mercado Pago is also on', () => {
    expect(describeHowToPay(['cash', 'wompi', 'mercadopago'])).toBe(
      'Pagas en efectivo al recibir o en línea con tarjeta, PSE o Nequi.',
    )
  })

  it('does not promise Nequi when only Mercado Pago is online', () => {
    expect(describeHowToPay(['cash', 'mercadopago'])).toBe(
      'Pagas en efectivo al recibir o en línea con tarjeta o PSE.',
    )
  })

  it('says cash only when no gateway is configured', () => {
    expect(describeHowToPay(['cash'])).toBe(
      'Pagas en efectivo al recibir o al recoger tu pedido.',
    )
  })

  it('never advertises the development mock', () => {
    expect(describeHowToPay(['cash', 'mock'])).toBe(
      'Pagas en efectivo al recibir o al recoger tu pedido.',
    )
  })

  it('covers an online-only setup', () => {
    expect(describeHowToPay(['wompi'])).toBe(
      'Pagas en línea con tarjeta, PSE o Nequi.',
    )
  })

  it('falls back to a neutral line when nothing is available', () => {
    expect(describeHowToPay([])).toBe('Pagas como acepte cada negocio.')
  })
})
