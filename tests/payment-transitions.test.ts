import { describe, expect, it } from 'vitest'
import { canApplyPaymentStatus } from '@/lib/payments/transitions'

describe('canApplyPaymentStatus', () => {
  it('forbids overwriting a paid payment with failed', () => {
    expect(canApplyPaymentStatus('paid', 'failed')).toBe(false)
  })

  it('allows paid to refunded', () => {
    expect(canApplyPaymentStatus('paid', 'refunded')).toBe(true)
  })

  it('allows failed to paid (late approval)', () => {
    expect(canApplyPaymentStatus('failed', 'paid')).toBe(true)
  })

  it('treats refunded as terminal', () => {
    expect(canApplyPaymentStatus('refunded', 'paid')).toBe(false)
    expect(canApplyPaymentStatus('refunded', 'failed')).toBe(false)
    expect(canApplyPaymentStatus('refunded', 'pending')).toBe(false)
  })

  it('allows any same-to-same transition as a no-op', () => {
    expect(canApplyPaymentStatus('paid', 'paid')).toBe(true)
    expect(canApplyPaymentStatus('pending', 'pending')).toBe(true)
    expect(canApplyPaymentStatus('failed', 'failed')).toBe(true)
    expect(canApplyPaymentStatus('refunded', 'refunded')).toBe(true)
  })

  it('allows pending to move to any other status', () => {
    expect(canApplyPaymentStatus('pending', 'paid')).toBe(true)
    expect(canApplyPaymentStatus('pending', 'failed')).toBe(true)
    expect(canApplyPaymentStatus('pending', 'refunded')).toBe(true)
  })

  it('allows failed to move back to pending (retry)', () => {
    expect(canApplyPaymentStatus('failed', 'pending')).toBe(true)
  })
})
