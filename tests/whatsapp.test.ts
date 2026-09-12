import { describe, expect, it } from 'vitest'
import {
  buildOrderMessage,
  buildWhatsAppUrl,
  normalizePhone,
} from '@/lib/orders/whatsapp'

describe('normalizePhone', () => {
  it('strips formatting and assumes Colombia when no country code is given', () => {
    expect(normalizePhone('+57 300 123-4567')).toBe('573001234567')
    expect(normalizePhone('3001234567')).toBe('573001234567')
    expect(normalizePhone('')).toBeNull()
  })
})

describe('buildWhatsAppUrl', () => {
  it('builds a wa.me link with the encoded message', () => {
    expect(
      buildWhatsAppUrl('+57 300 1234567', 'Hola, ¿cómo va mi pedido?'),
    ).toBe(
      'https://wa.me/573001234567?text=Hola%2C%20%C2%BFc%C3%B3mo%20va%20mi%20pedido%3F',
    )
  })

  it('returns null without a usable phone', () => {
    expect(buildWhatsAppUrl(null, 'x')).toBeNull()
  })
})

describe('buildOrderMessage', () => {
  it('summarises the order for the restaurant chat', () => {
    const message = buildOrderMessage({
      shortCode: 'AB12CD',
      storeName: 'Verde Bowl',
      customerName: 'Ana',
      type: 'delivery',
      items: [
        {
          name: 'Bowl verde',
          quantity: 2,
          options: [{ option: 'Proteína', value: 'Pollo', price_delta: 0 }],
        },
        { name: 'Jugo', quantity: 1, options: [] },
      ],
      total: 45000,
      address: 'Calle 93 # 12-20',
      notes: 'Sin cebolla',
    })
    expect(message).toContain('#AB12CD')
    expect(message).toContain('Verde Bowl')
    expect(message).toContain('2× Bowl verde (Proteína: Pollo)')
    expect(message).toContain('1× Jugo')
    expect(message).toContain('Domicilio')
    expect(message).toContain('Calle 93 # 12-20')
    expect(message).toContain('Sin cebolla')
    expect(message).toContain('$ 45.000')
  })
})
