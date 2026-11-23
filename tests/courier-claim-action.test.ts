// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/server', () => ({ after: () => {} }))
vi.mock('@/lib/push/send', () => ({ sendPushToUsers: async () => {} }))
vi.mock('@/lib/courier/server', () => ({
  fetchAddressesById: async () => new Map(),
  fetchCourierPosition: async () => null,
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    throw new Error('claimOrder must not need the service role')
  },
}))

let role = 'courier'
vi.mock('@/lib/auth/resolve-role', () => ({
  resolveUserRole: async () => role,
}))

const tablesTouched: string[] = []
const APPROVED = {
  status: 'approved',
  vehicle_type: 'bicycle',
  license_expires_on: null,
  soat_expires_on: null,
}
let courierProfile: Record<string, unknown> | null = APPROVED
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from(table: string) {
      tablesTouched.push(table)
      if (table === 'courier_profiles') {
        // select().eq().maybeSingle(): the courier's own row, under RLS.
        const read = {
          select: () => read,
          eq: () => read,
          maybeSingle: async () => ({ data: courierProfile, error: null }),
        }
        return read
      }
      // update().eq().is().eq().eq().select(): nothing matched, as when
      // another courier was faster.
      const chain = {
        update: () => chain,
        eq: () => chain,
        is: () => chain,
        select: async () => ({ data: [], error: null }),
      }
      return chain
    },
  }),
}))

const ORDER_ID = '7f1c1d3e-8f5e-4c7a-9a39-5d5c2f6b1a10'

describe('claimOrder', () => {
  beforeEach(() => {
    tablesTouched.length = 0
    courierProfile = APPROVED
  })

  // /courier is open to admins, whose RLS lets them update any order: their
  // tap used to take the delivery away from the couriers.
  it('refuses an admin without touching the order', async () => {
    role = 'admin'
    const { claimOrder } = await import('@/app/courier/actions')
    expect(await claimOrder(ORDER_ID)).toEqual({
      ok: false,
      error: 'Solo los domiciliarios pueden tomar pedidos.',
    })
    expect(tablesTouched).toEqual([])
  })

  it('lets a courier try to claim the order', async () => {
    role = 'courier'
    const { claimOrder } = await import('@/app/courier/actions')
    expect(await claimOrder(ORDER_ID)).toEqual({
      ok: false,
      error: 'Otro domiciliario tomó este pedido.',
    })
    expect(tablesTouched).toEqual(['courier_profiles', 'orders'])
  })

  // The pool is closed by RLS until an admin approves the courier; the action
  // says why instead of reporting that someone else was faster.
  it('tells a courier in review why they cannot claim, without touching the order', async () => {
    role = 'courier'
    courierProfile = { ...APPROVED, status: 'pending' }
    const { claimOrder } = await import('@/app/courier/actions')
    const result = await claimOrder(ORDER_ID)
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toMatch(/en revisión/)
    expect(tablesTouched).toEqual(['courier_profiles'])
  })

  it('asks a courier without a profile to complete it', async () => {
    role = 'courier'
    courierProfile = null
    const { claimOrder } = await import('@/app/courier/actions')
    const result = await claimOrder(ORDER_ID)
    expect(!result.ok && result.error).toMatch(/Completa tu perfil/)
  })
})
