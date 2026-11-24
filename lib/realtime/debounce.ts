// Trailing-edge debouncer shared by the realtime refresh and backfill paths.
// Pure timer bookkeeping, no React and no DOM, so it can be unit tested.

export interface Debouncer {
  /** Queues `run`, replacing whatever was queued before, and restarts the wait. */
  schedule(run: () => void): void
  /** Runs the queued callback now, if there is one. */
  flush(): void
  /** Drops the queued callback without running it. */
  cancel(): void
}

/**
 * Collapses a burst of calls into one.
 *
 * A single user action can produce several realtime events — `claimOrder`
 * writes `courier_id` and then `estimated_at`, which is two UPDATEs — and each
 * one would otherwise cost a full RSC round-trip.
 */
export function createDebouncer(waitMs: number): Debouncer {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: (() => void) | null = null

  const fire = () => {
    timer = null
    const run = pending
    pending = null
    run?.()
  }

  return {
    schedule(run) {
      pending = run
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(fire, waitMs)
    },
    flush() {
      if (timer === null) return
      clearTimeout(timer)
      fire()
    },
    cancel() {
      if (timer !== null) clearTimeout(timer)
      timer = null
      pending = null
    },
  }
}

/**
 * Runs the first call at once, then folds every call made within `waitMs`
 * into one more run when the window closes.
 *
 * For the screen refresh after a realtime event: the trailing debouncer above
 * made every change wait `waitMs` before the screen even started to update.
 * This one starts it immediately, and a burst (two UPDATEs from one action)
 * still costs at most one extra round trip, which picks up the later write.
 */
export function createLeadingDebouncer(waitMs: number): Debouncer {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: (() => void) | null = null

  const close = () => {
    const run = pending
    pending = null
    if (run) {
      // The trailing run opens a window of its own, so a steady stream of
      // events refreshes at most once per `waitMs`.
      run()
      timer = setTimeout(close, waitMs)
    } else {
      timer = null
    }
  }

  return {
    schedule(run) {
      if (timer === null) {
        run()
        timer = setTimeout(close, waitMs)
      } else {
        pending = run
      }
    },
    flush() {
      if (timer === null) return
      clearTimeout(timer)
      timer = null
      const run = pending
      pending = null
      run?.()
    },
    cancel() {
      if (timer !== null) clearTimeout(timer)
      timer = null
      pending = null
    },
  }
}
