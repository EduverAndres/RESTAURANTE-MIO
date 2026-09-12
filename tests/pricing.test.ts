import { describe, expect, it } from 'vitest'
import {
  TIP_PRESETS,
  computeLineTotal,
  computeOrderTotals,
  computeTip,
  meetsMinOrder,
  optionsDelta,
} from '@/lib/pricing'

describe('optionsDelta', () => {
  it('sums the price deltas of the selected options', () => {
    expect(
      optionsDelta([
        { option: 'Tamaño', value: 'Grande', price_delta: 3000 },
        { option: 'Extra', value: 'Queso', price_delta: 1500 },
      ]),
    ).toBe(4500)
  })

  it('returns 0 without options', () => {
    expect(optionsDelta([])).toBe(0)
  })
})

describe('computeLineTotal', () => {
  it('multiplies unit price plus option deltas by the quantity', () => {
    expect(
      computeLineTotal({
        unitPrice: 18900,
        quantity: 2,
        options: [{ option: 'Extra', value: 'Queso', price_delta: 1500 }],
      }),
    ).toBe(40800)
  })

  it('never returns negative totals', () => {
    expect(
      computeLineTotal({
        unitPrice: 1000,
        quantity: 1,
        options: [{ option: 'Descuento', value: 'x', price_delta: -5000 }],
      }),
    ).toBe(0)
  })
})

describe('computeTip', () => {
  it('computes a percentage tip rounded to the nearest 100 pesos', () => {
    expect(computeTip(41234, { kind: 'percent', value: 10 })).toBe(4100)
  })

  it('accepts a fixed amount and clamps negatives', () => {
    expect(computeTip(41234, { kind: 'fixed', value: 2000 })).toBe(2000)
    expect(computeTip(41234, { kind: 'fixed', value: -5 })).toBe(0)
  })

  it('exposes the preset percentages', () => {
    expect(TIP_PRESETS).toEqual([0, 5, 10, 15])
  })
})

describe('computeOrderTotals', () => {
  const items = [
    { unitPrice: 18900, quantity: 2, options: [] },
    {
      unitPrice: 9500,
      quantity: 1,
      options: [{ option: 'Extra', value: 'Queso', price_delta: 1500 }],
    },
  ]

  it('adds delivery fee and tip for delivery orders', () => {
    expect(
      computeOrderTotals({
        items,
        type: 'delivery',
        deliveryFee: 4500,
        tip: 2000,
      }),
    ).toEqual({ subtotal: 48800, deliveryFee: 4500, tip: 2000, total: 55300 })
  })

  it('drops the delivery fee for pickup and table orders', () => {
    expect(
      computeOrderTotals({ items, type: 'pickup', deliveryFee: 4500, tip: 0 }),
    ).toEqual({ subtotal: 48800, deliveryFee: 0, tip: 0, total: 48800 })
    expect(
      computeOrderTotals({ items, type: 'table', deliveryFee: 4500, tip: 0 })
        .deliveryFee,
    ).toBe(0)
  })

  it('returns zeros for an empty cart', () => {
    expect(
      computeOrderTotals({
        items: [],
        type: 'delivery',
        deliveryFee: 4500,
        tip: 0,
      }),
    ).toEqual({ subtotal: 0, deliveryFee: 0, tip: 0, total: 0 })
  })
})

describe('meetsMinOrder', () => {
  it('compares the subtotal with the store minimum', () => {
    expect(meetsMinOrder(20000, 20000)).toBe(true)
    expect(meetsMinOrder(19999, 20000)).toBe(false)
    expect(meetsMinOrder(1, null)).toBe(true)
  })
})
