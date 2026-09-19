// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/auth', () => ({
  requireRole: async () => ({ user: { id: 'admin-1' }, role: 'admin' }),
}))

// ---------------------------------------------------------------------------
// Generating a period used to be five round trips — read orders, read pending
// refunds, read settled payouts, insert a payout row, stamp the refunds it
// carried — and every gap between them was a way to lose money:
//
//   * a stamp that failed left the deduction applied and the refund pending,
//     so the same refund was clawed back again every period, forever;
//   * the orders snapshot was read before the refunds, so a refund recorded in
//     that window was settled in full AND closed with no clawback.
//
// Both are gone because the run is now one transaction. This suite holds the
// line that makes that true: the action must not read or write these tables
// itself, whatever it is asked to do.
// ---------------------------------------------------------------------------

interface RpcCall {
  name: string
  args: Record<string, unknown>
}

function fakeAdmin(result: {
  data?: unknown
  error?: { message: string } | null
}) {
  const calls: RpcCall[] = []
  const admin = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args })
      return { data: result.data ?? null, error: result.error ?? null }
    },
    from(table: string) {
      throw new Error(
        `generatePayouts must not touch "${table}" directly: the run is one transaction`,
      )
    },
  }
  return { admin, calls }
}

let current: ReturnType<typeof fakeAdmin>

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => current.admin,
}))

const PERIOD = ['2026-09-14', '2026-09-20'] as const

const RUN = {
  payouts_created: 3,
  payouts_skipped: 1,
  refunds_reversed: 2,
  refunds_resolved: 5,
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function generate(period: readonly [string, string] = PERIOD) {
  const { generatePayouts } = await import('@/app/admin/actions')
  return generatePayouts(period[0], period[1])
}

describe('generatePayouts', () => {
  it('completes the whole run in exactly one atomic call', async () => {
    current = fakeAdmin({ data: [RUN] })

    const result = await generate()

    expect(current.calls).toEqual([
      {
        name: 'generate_payouts',
        args: { p_period_start: '2026-09-14', p_period_end: '2026-09-20' },
      },
    ])
    expect(result).toEqual({ ok: true, created: 3, skipped: 1 })
  })

  it('reports failure when the transaction did not commit', async () => {
    // FINDING 1. The old shape could apply a deduction, fail to stamp the
    // refund it came from, and still answer `ok` — which is what made the
    // repeated clawback invisible. Now a run either commits whole or reports
    // that it did not.
    current = fakeAdmin({ error: { message: 'deadlock detected' } })

    expect(await generate()).toEqual({
      ok: false,
      error: 'No pudimos generar las liquidaciones. Inténtalo de nuevo.',
    })
  })

  it('reports failure when the function returned no row', async () => {
    current = fakeAdmin({ data: [] })

    const result = await generate()

    expect(result.ok).toBe(false)
  })

  it('never reads the orders snapshot from JavaScript', async () => {
    // FINDING 2. Eligibility read out here and written back later is the
    // stale snapshot that settled refunded sales in full. `from()` throwing
    // is the guard: the eligibility read now happens inside the transaction.
    current = fakeAdmin({ data: [RUN] })

    await expect(generate()).resolves.toEqual({
      ok: true,
      created: 3,
      skipped: 1,
    })
    expect(current.calls).toHaveLength(1)
  })

  it('refuses an invalid period without touching the database', async () => {
    current = fakeAdmin({ data: [RUN] })

    expect(await generate(['2026-09-20', '2026-09-14'])).toEqual({
      ok: false,
      error: 'Selecciona un periodo válido.',
    })
    expect(current.calls).toEqual([])
  })
})
