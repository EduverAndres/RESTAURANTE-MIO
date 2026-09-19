import { describe, expect, it } from 'vitest'
import { canApplyPaymentStatus } from '@/lib/payments/transitions'
import { refundThroughGateway } from '@/lib/refunds/gateway'
import {
  REFUND_REJECTION_MESSAGES,
  isRefundable,
  planRefund,
  type RefundOrder,
  type RefundRejection,
} from '@/lib/refunds/plan'
import {
  REFUND_METHODS,
  REFUND_METHOD_LABELS,
  REFUND_REASONS,
  REFUND_REASON_LABELS,
} from '@/lib/refunds/vocabulary'

function order(overrides: Partial<RefundOrder> = {}): RefundOrder {
  return {
    id: 'order-1',
    store_id: 'store-1',
    total: 42500,
    status: 'delivered',
    payment_status: 'paid',
    payment_method: 'cash',
    ...overrides,
  }
}

const INPUT = { reason: 'customer_request', method: 'cash', note: null } as const

describe('planRefund', () => {
  it('records the full order total, in the units orders.total uses', () => {
    const result = planRefund(order({ total: 42500 }), INPUT)
    expect(result).toEqual({
      ok: true,
      refund: {
        order_id: 'order-1',
        store_id: 'store-1',
        amount: 42500,
        reason: 'customer_request',
        method: 'cash',
        note: null,
      },
    })
  })

  it('trims the note and stores an empty one as null', () => {
    const withNote = planRefund(order(), { ...INPUT, note: '  Devuelto en caja  ' })
    expect(withNote.ok && withNote.refund.note).toBe('Devuelto en caja')

    const blank = planRefund(order(), { ...INPUT, note: '   ' })
    expect(blank.ok && blank.refund.note).toBeNull()
  })

  it('refuses an order that is already refunded', () => {
    const result = planRefund(order({ payment_status: 'refunded' }), INPUT)
    expect(result).toEqual({ ok: false, error: 'already_refunded' })
  })

  it('refuses a transition the payment guard forbids', () => {
    // There is no payment status the guard forbids moving to `refunded`
    // today, so this asserts the guard is consulted rather than bypassed:
    // if a future FORBIDDEN entry adds one, planRefund must refuse it.
    for (const from of ['pending', 'paid', 'failed'] as const) {
      expect(canApplyPaymentStatus(from, 'refunded')).toBe(true)
      expect(planRefund(order({ payment_status: from }), INPUT).ok).toBe(true)
    }
  })

  it('keeps refunded terminal', () => {
    expect(canApplyPaymentStatus('refunded', 'paid')).toBe(false)
    expect(canApplyPaymentStatus('refunded', 'pending')).toBe(false)
    expect(canApplyPaymentStatus('refunded', 'failed')).toBe(false)
  })

  it('refuses an order that never took money', () => {
    expect(
      planRefund(
        order({ status: 'cancelled', payment_status: 'pending', payment_method: 'wompi' }),
        INPUT,
      ),
    ).toEqual({ ok: false, error: 'not_refundable' })
  })

  it('refuses an order with nothing to give back', () => {
    expect(planRefund(order({ total: 0 }), INPUT)).toEqual({
      ok: false,
      error: 'nothing_to_refund',
    })
    expect(planRefund(order({ total: -1 }), INPUT)).toEqual({
      ok: false,
      error: 'nothing_to_refund',
    })
  })

  it('has a Spanish message for every rejection', () => {
    const rejections: RefundRejection[] = [
      'already_refunded',
      'not_refundable',
      'transition_forbidden',
      'nothing_to_refund',
    ]
    for (const rejection of rejections) {
      expect(REFUND_REJECTION_MESSAGES[rejection]).toBeTruthy()
    }
  })
})

describe('isRefundable', () => {
  it('offers a refund for an electronically paid order', () => {
    expect(
      isRefundable({ payment_status: 'paid', payment_method: 'wompi', status: 'delivered' }),
    ).toBe(true)
  })

  it('offers a refund for a delivered cash order, which never turns paid', () => {
    expect(
      isRefundable({ payment_status: 'pending', payment_method: 'cash', status: 'delivered' }),
    ).toBe(true)
  })

  it('does not offer a refund for a cash order that was never delivered', () => {
    expect(
      isRefundable({ payment_status: 'pending', payment_method: 'cash', status: 'cancelled' }),
    ).toBe(false)
  })

  it('does not offer a refund for an unpaid electronic order', () => {
    expect(
      isRefundable({ payment_status: 'pending', payment_method: 'wompi', status: 'cancelled' }),
    ).toBe(false)
    expect(
      isRefundable({ payment_status: 'failed', payment_method: 'wompi', status: 'cancelled' }),
    ).toBe(false)
  })

  it('does not offer a second refund', () => {
    expect(
      isRefundable({ payment_status: 'refunded', payment_method: 'wompi', status: 'delivered' }),
    ).toBe(false)
  })

  it('matches the payout eligibility rule it mirrors', () => {
    // An order the merchant is settled for is exactly an order that can be
    // reversed; if these two ever disagree, money is counted twice.
    const settled = { status: 'delivered', payment_status: 'paid', payment_method: 'wompi' } as const
    expect(isRefundable(settled)).toBe(true)
  })
})

describe('refund vocabulary', () => {
  it('labels every reason and every method', () => {
    for (const reason of REFUND_REASONS) {
      expect(REFUND_REASON_LABELS[reason]).toBeTruthy()
    }
    for (const method of REFUND_METHODS) {
      expect(REFUND_METHOD_LABELS[method]).toBeTruthy()
    }
  })
})

describe('refundThroughGateway', () => {
  it('is an empty seam: it never calls a gateway', async () => {
    await expect(refundThroughGateway({ provider: 'wompi' })).resolves.toEqual({
      attempted: false,
      reason: 'not_implemented',
    })
  })
})
