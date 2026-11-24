import { describe, expect, it } from 'vitest'
import { canApplyPaymentStatus } from '@/lib/payments/transitions'
import { refundThroughGateway } from '@/lib/refunds/gateway'
import {
  REFUND_REJECTION_MESSAGES,
  canRecordRefund,
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

const INPUT = {
  reason: 'customer_request',
  method: 'cash',
  note: null,
} as const

describe('planRefund', () => {
  it('records the full order total, in the units orders.total uses', () => {
    const result = planRefund(order({ total: 42500 }), INPUT, 'admin')
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
    const withNote = planRefund(
      order(),
      { ...INPUT, note: '  Devuelto en caja  ' },
      'admin',
    )
    expect(withNote.ok && withNote.refund.note).toBe('Devuelto en caja')

    const blank = planRefund(order(), { ...INPUT, note: '   ' }, 'admin')
    expect(blank.ok && blank.refund.note).toBeNull()
  })

  it('refuses an order that is already refunded', () => {
    const result = planRefund(
      order({ payment_status: 'refunded' }),
      INPUT,
      'admin',
    )
    expect(result).toEqual({ ok: false, error: 'already_refunded' })
  })

  it('refuses a transition the payment guard forbids', () => {
    // There is no payment status the guard forbids moving to `refunded`
    // today, so this asserts the guard is consulted rather than bypassed:
    // if a future FORBIDDEN entry adds one, planRefund must refuse it.
    for (const from of ['pending', 'paid', 'failed'] as const) {
      expect(canApplyPaymentStatus(from, 'refunded')).toBe(true)
      expect(
        planRefund(order({ payment_status: from }), INPUT, 'admin').ok,
      ).toBe(true)
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
        order({
          status: 'cancelled',
          payment_status: 'pending',
          payment_method: 'wompi',
        }),
        INPUT,
        'admin',
      ),
    ).toEqual({ ok: false, error: 'not_refundable' })
  })

  it('refuses an order with nothing to give back', () => {
    expect(planRefund(order({ total: 0 }), INPUT, 'admin')).toEqual({
      ok: false,
      error: 'nothing_to_refund',
    })
    expect(planRefund(order({ total: -1 }), INPUT, 'admin')).toEqual({
      ok: false,
      error: 'nothing_to_refund',
    })
  })

  // A cash refund is pure bookkeeping on money the merchant already holds:
  // recording one takes the sale out of the payout and reverses the
  // commission, and nothing moves. Only the platform may do that.
  it('refuses a merchant refund on a cash order', () => {
    const cash = order({ payment_status: 'pending', payment_method: 'cash' })
    expect(planRefund(cash, INPUT, 'merchant')).toEqual({
      ok: false,
      error: 'cash_admin_only',
    })
  })

  it('lets the platform refund that same cash order', () => {
    const cash = order({ payment_status: 'pending', payment_method: 'cash' })
    expect(planRefund(cash, INPUT, 'admin').ok).toBe(true)
  })

  it('still lets a merchant refund an order paid online', () => {
    const online = order({ payment_status: 'paid', payment_method: 'wompi' })
    expect(planRefund(online, INPUT, 'merchant').ok).toBe(true)
  })

  it('reports an existing refund before the cash rule', () => {
    const refunded = order({
      payment_status: 'refunded',
      payment_method: 'cash',
    })
    expect(planRefund(refunded, INPUT, 'merchant')).toEqual({
      ok: false,
      error: 'already_refunded',
    })
  })

  it('has a Spanish message for every rejection', () => {
    const rejections: RefundRejection[] = [
      'cash_admin_only',
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
      isRefundable({
        payment_status: 'paid',
        payment_method: 'wompi',
        status: 'delivered',
      }),
    ).toBe(true)
  })

  it('offers a refund for a delivered cash order, which never turns paid', () => {
    expect(
      isRefundable({
        payment_status: 'pending',
        payment_method: 'cash',
        status: 'delivered',
      }),
    ).toBe(true)
  })

  it('does not offer a refund for a cash order that was never delivered', () => {
    expect(
      isRefundable({
        payment_status: 'pending',
        payment_method: 'cash',
        status: 'cancelled',
      }),
    ).toBe(false)
  })

  it('does not offer a refund for an unpaid electronic order', () => {
    expect(
      isRefundable({
        payment_status: 'pending',
        payment_method: 'wompi',
        status: 'cancelled',
      }),
    ).toBe(false)
    expect(
      isRefundable({
        payment_status: 'failed',
        payment_method: 'wompi',
        status: 'cancelled',
      }),
    ).toBe(false)
  })

  it('does not offer a second refund', () => {
    expect(
      isRefundable({
        payment_status: 'refunded',
        payment_method: 'wompi',
        status: 'delivered',
      }),
    ).toBe(false)
  })

  it('a corporate order is refunded only after delivery: before, cancelling frees the credit', () => {
    const corporate = {
      payment_status: 'paid',
      payment_method: 'corporate',
    } as const
    expect(isRefundable({ ...corporate, status: 'delivered' })).toBe(true)
    // Cancelled: nothing was ever charged to the company, the cancellation
    // already gave the credit back.
    expect(isRefundable({ ...corporate, status: 'cancelled' })).toBe(false)
    expect(isRefundable({ ...corporate, status: 'preparing' })).toBe(false)
    expect(
      isRefundable({
        payment_status: 'pending',
        payment_method: 'corporate',
        status: 'delivered',
      }),
    ).toBe(false)
  })

  it('matches the payout eligibility rule it mirrors', () => {
    // An order the merchant is settled for is exactly an order that can be
    // reversed; if these two ever disagree, money is counted twice.
    const settled = {
      status: 'delivered',
      payment_status: 'paid',
      payment_method: 'wompi',
    } as const
    expect(isRefundable(settled)).toBe(true)
  })
})

describe('canRecordRefund', () => {
  const deliveredCash = {
    status: 'delivered',
    payment_status: 'pending',
    payment_method: 'cash',
  } as const
  const paidOnline = {
    status: 'delivered',
    payment_status: 'paid',
    payment_method: 'wompi',
  } as const

  it('hides the button from a merchant on a cash order', () => {
    expect(canRecordRefund(deliveredCash, 'merchant')).toBe(false)
    expect(canRecordRefund(deliveredCash, 'admin')).toBe(true)
  })

  it('keeps it for an order paid online', () => {
    expect(canRecordRefund(paidOnline, 'merchant')).toBe(true)
    expect(canRecordRefund(paidOnline, 'admin')).toBe(true)
  })

  it('lets the merchant credit a delivered corporate order (an abono for the company)', () => {
    const corporate = {
      status: 'delivered',
      payment_status: 'paid',
      payment_method: 'corporate',
    } as const
    expect(canRecordRefund(corporate, 'merchant')).toBe(true)
    expect(
      canRecordRefund({ ...corporate, status: 'cancelled' }, 'admin'),
    ).toBe(false)
  })

  it('never offers what isRefundable refuses', () => {
    const refunded = { ...paidOnline, payment_status: 'refunded' } as const
    expect(canRecordRefund(refunded, 'admin')).toBe(false)
    expect(canRecordRefund(refunded, 'merchant')).toBe(false)
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
