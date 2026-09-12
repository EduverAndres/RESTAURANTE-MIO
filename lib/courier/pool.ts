// Client-side memory of which orders the courier currently sees in the pool.
//
// Realtime payloads cannot answer "was this already in the pool?": no table in
// the publication uses `replica identity full`, so `payload.old` carries the
// primary key and nothing else. Comparing against it always says "no", which
// is why the pool toast used to fire on every visible order change. The
// previous state is tracked here instead.

import type { OrderStatus, OrderType } from '@/types/app'

export interface PoolRowLike {
  id?: string | null
  courier_id?: string | null
  status?: OrderStatus | string | null
  type?: OrderType | string | null
}

/** The pool: an unclaimed delivery the restaurant has marked ready. */
export function isPoolRow(row: PoolRowLike | null | undefined): boolean {
  return (
    !!row &&
    row.courier_id === null &&
    row.status === 'ready' &&
    row.type === 'delivery'
  )
}

export interface PoolTracker {
  /** Records the row; true only when it just entered the pool. */
  observe(row: PoolRowLike | null | undefined): boolean
  /** Replaces what is known with a freshly reconciled list of ids. */
  reset(ids: Iterable<string>): void
  has(id: string): boolean
  ids(): string[]
}

/**
 * Seed with the ids the server already rendered, so the first events about
 * orders the courier can already see stay silent.
 */
export function createPoolTracker(
  initialIds: Iterable<string> = [],
): PoolTracker {
  let known = new Set(initialIds)

  return {
    observe(row) {
      const id = row?.id
      if (!id) return false
      const wasInPool = known.has(id)
      const nowInPool = isPoolRow(row)
      if (nowInPool) known.add(id)
      else known.delete(id)
      return nowInPool && !wasInPool
    },
    reset(ids) {
      known = new Set(ids)
    },
    has(id) {
      return known.has(id)
    },
    ids() {
      return [...known]
    },
  }
}
