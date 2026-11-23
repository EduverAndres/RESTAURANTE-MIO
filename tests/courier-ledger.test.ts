import { describe, expect, it } from 'vitest'
import {
  REFUND_KEEPS_COURIER_EARNINGS,
  cashExposure,
  cashOwedFor,
  courierEntryFor,
  courierPayoutNet,
  isCourierEntryEligible,
  isOverCashCap,
  ledgerBalance,
  type CourierLedgerOrder,
} from '@/lib/couriers/ledger'

function order(
  overrides: Partial<CourierLedgerOrder> = {},
): CourierLedgerOrder {
  return {
    status: 'delivered',
    type: 'delivery',
    courier_id: 'courier-1',
    payment_method: 'wompi',
    payment_status: 'paid',
    delivery_fee: 5000,
    tip: 2000,
    total: 47000,
    ...overrides,
  }
}

describe('isCourierEntryEligible', () => {
  it('records a delivered order a platform courier took', () => {
    expect(isCourierEntryEligible(order())).toBe(true)
    expect(
      isCourierEntryEligible(
        order({ payment_method: 'cash', payment_status: 'pending' }),
      ),
    ).toBe(true)
  })

  it('keeps a delivery that was refunded afterwards', () => {
    expect(REFUND_KEEPS_COURIER_EARNINGS).toBe(true)
    expect(isCourierEntryEligible(order({ payment_status: 'refunded' }))).toBe(
      true,
    )
  })

  it('ignores orders no platform courier delivered', () => {
    expect(isCourierEntryEligible(order({ courier_id: null }))).toBe(false)
    expect(isCourierEntryEligible(order({ type: 'pickup' }))).toBe(false)
    expect(isCourierEntryEligible(order({ status: 'picked_up' }))).toBe(false)
  })

  it('ignores an online order whose payment never went through', () => {
    expect(isCourierEntryEligible(order({ payment_status: 'pending' }))).toBe(
      false,
    )
    expect(isCourierEntryEligible(order({ payment_status: 'failed' }))).toBe(
      false,
    )
  })
})

describe('courierEntryFor', () => {
  it('owes the courier the delivery fee and tip on an online order', () => {
    expect(courierEntryFor(order())).toEqual({
      earnings: 7000,
      cash_collected: 0,
    })
  })

  it('makes the courier hold the whole total on a cash order', () => {
    expect(courierEntryFor(order({ payment_method: 'cash' }))).toEqual({
      earnings: 7000,
      cash_collected: 47000,
    })
    // Of which 40.000 is not theirs.
    expect(cashOwedFor(order({ payment_method: 'cash' }))).toBe(40000)
    expect(cashOwedFor(order())).toBe(0)
  })
})

describe('ledgerBalance', () => {
  it('nets earnings, cash held and deposits', () => {
    expect(
      ledgerBalance([
        { kind: 'delivery', earnings: 7000, cash_collected: 0, amount: 0 },
        { kind: 'delivery', earnings: 7000, cash_collected: 47000, amount: 0 },
        { kind: 'deposit', earnings: 0, cash_collected: 0, amount: 30000 },
      ]),
    ).toBe(7000 + 7000 - 47000 + 30000)
  })
})

describe('courierPayoutNet', () => {
  it('adds earnings, deposits and carried debt, minus the cash held', () => {
    expect(
      courierPayoutNet({
        earnings: 50000,
        cash_collected: 120000,
        adjustments: 80000,
        carried_in: -5000,
      }),
    ).toBe(5000)
  })
})

describe('the cash cap', () => {
  it('counts orders in progress against what the platform owes the courier', () => {
    expect(cashExposure({ balance: -100000, inProgressOwed: 40000 })).toBe(
      140000,
    )
    expect(cashExposure({ balance: 30000, inProgressOwed: 40000 })).toBe(10000)
  })

  it('refuses the order that would cross the cap, not the one that reaches it', () => {
    expect(
      isOverCashCap({ exposure: 110000, newOrderOwed: 40000, cap: 150000 }),
    ).toBe(false)
    expect(
      isOverCashCap({ exposure: 110001, newOrderOwed: 40000, cap: 150000 }),
    ).toBe(true)
  })
})
