import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyGatewayStatus } from '@/lib/payments/wompi/apply-status'
import type { Database } from '@/types/database'

interface Written {
  payload: Record<string, unknown>
  value: string
}

/** Minimal service-role client: records the update chain and returns `error`. */
function fakeAdmin(error: { message: string } | null = null) {
  const writes: Written[] = []
  const admin = {
    from() {
      return {
        update(payload: Record<string, unknown>) {
          return {
            eq: async (_column: string, value: string) => {
              writes.push({ payload, value })
              return { error }
            },
          }
        },
      }
    },
  }
  return { admin: admin as unknown as SupabaseClient<Database>, writes }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('applyGatewayStatus', () => {
  it('stores an approved payment without touching the order status', async () => {
    const { admin, writes } = fakeAdmin()
    const result = await applyGatewayStatus(
      admin,
      { id: 'order-1', status: 'pending', payment_status: 'pending' },
      'paid',
    )
    expect(result).toEqual({ reopened: false })
    expect(writes).toEqual([
      { payload: { payment_status: 'paid' }, value: 'order-1' },
    ])
  })

  it('reopens an auto-cancelled order when a late approval arrives', async () => {
    const { admin, writes } = fakeAdmin()
    const result = await applyGatewayStatus(
      admin,
      { id: 'order-1', status: 'cancelled', payment_status: 'failed' },
      'paid',
    )
    expect(result).toEqual({ reopened: true })
    expect(writes).toEqual([
      {
        payload: { payment_status: 'paid', status: 'pending' },
        value: 'order-1',
      },
    ])
  })

  it('leaves a delivered order alone when the payment is approved', async () => {
    const { admin, writes } = fakeAdmin()
    const result = await applyGatewayStatus(
      admin,
      { id: 'order-1', status: 'delivered', payment_status: 'pending' },
      'paid',
    )
    expect(result).toEqual({ reopened: false })
    expect(writes).toEqual([
      { payload: { payment_status: 'paid' }, value: 'order-1' },
    ])
  })

  it('does not report a reopen when the reopening write fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { admin } = fakeAdmin({ message: 'permission denied' })
    const result = await applyGatewayStatus(
      admin,
      { id: 'order-1', status: 'cancelled', payment_status: 'failed' },
      'paid',
    )
    expect(result).toEqual({ reopened: false })
  })

  it('cancels a still-pending order when the payment failed', async () => {
    const { admin, writes } = fakeAdmin()
    await applyGatewayStatus(
      admin,
      { id: 'order-1', status: 'pending', payment_status: 'pending' },
      'failed',
    )
    expect(writes).toEqual([
      {
        payload: { payment_status: 'failed', status: 'cancelled' },
        value: 'order-1',
      },
    ])
  })

  it('does not re-cancel an order that already moved past pending', async () => {
    const { admin, writes } = fakeAdmin()
    await applyGatewayStatus(
      admin,
      { id: 'order-1', status: 'accepted', payment_status: 'pending' },
      'failed',
    )
    expect(writes).toEqual([
      { payload: { payment_status: 'failed' }, value: 'order-1' },
    ])
  })

  it('skips a forbidden transition and never writes', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { admin, writes } = fakeAdmin()
    const result = await applyGatewayStatus(
      admin,
      { id: 'order-1', status: 'delivered', payment_status: 'paid' },
      'failed',
    )
    expect(result).toEqual({ reopened: false })
    expect(writes).toEqual([])
    expect(log).toHaveBeenCalled()
  })

  it('logs a database error without throwing', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = { message: 'permission denied' }
    const { admin } = fakeAdmin(error)
    await expect(
      applyGatewayStatus(
        admin,
        { id: 'order-1', status: 'pending', payment_status: 'pending' },
        'paid',
      ),
    ).resolves.toEqual({ reopened: false })
    expect(log).toHaveBeenCalledWith('Failed to apply gateway payment status', error)
  })
})
