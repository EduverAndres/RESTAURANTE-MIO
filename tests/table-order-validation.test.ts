import { describe, expect, it } from 'vitest'
import {
  TABLE_PAYMENT_METHODS,
  guestOrderNotes,
  tableOrderSchema,
} from '@/lib/validations/table-order'

const PRODUCT = '11111111-1111-4111-8111-111111111111'

const valid = {
  guestName: 'Ana',
  notes: '',
  paymentMethod: 'cash',
  items: [{ productId: PRODUCT, quantity: 1, optionValueIds: [], notes: '' }],
}

describe('tableOrderSchema', () => {
  it('accepts a minimal guest order and applies defaults', () => {
    const parsed = tableOrderSchema.safeParse({
      guestName: '  Ana  ',
      paymentMethod: 'cash',
      items: [{ productId: PRODUCT, quantity: 2 }],
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.guestName).toBe('Ana')
    expect(parsed.data.notes).toBe('')
    expect(parsed.data.items[0].optionValueIds).toEqual([])
    expect(parsed.data.items[0].notes).toBe('')
  })

  it('offers cash, the mock gateway and Wompi', () => {
    expect([...TABLE_PAYMENT_METHODS]).toEqual(['cash', 'mock', 'wompi'])
    const parsed = tableOrderSchema.safeParse({
      ...valid,
      paymentMethod: 'wompi',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects a payment method outside the table list', () => {
    const parsed = tableOrderSchema.safeParse({
      ...valid,
      paymentMethod: 'mercadopago',
    })
    expect(parsed.success).toBe(false)
  })

  it('requires a guest name between 2 and 60 characters', () => {
    expect(
      tableOrderSchema.safeParse({ ...valid, guestName: 'A' }).success,
    ).toBe(false)
    expect(
      tableOrderSchema.safeParse({ ...valid, guestName: 'x'.repeat(61) })
        .success,
    ).toBe(false)
  })

  it('rejects an empty cart with a Spanish message', () => {
    const parsed = tableOrderSchema.safeParse({ ...valid, items: [] })
    expect(parsed.success).toBe(false)
    if (parsed.success) return
    expect(parsed.error.issues[0]?.message).toBe('Tu carrito está vacío.')
  })
})

describe('guestOrderNotes', () => {
  it('prefixes the guest name for anonymous orders', () => {
    expect(guestOrderNotes('Ana', 'Sin cebolla', true)).toBe(
      'Mesa a nombre de Ana · Sin cebolla',
    )
    expect(guestOrderNotes('Ana', '', true)).toBe('Mesa a nombre de Ana')
  })

  it('keeps the notes as-is for logged-in customers', () => {
    expect(guestOrderNotes('Ana', 'Sin cebolla', false)).toBe('Sin cebolla')
    expect(guestOrderNotes('Ana', '', false)).toBeNull()
  })
})
