import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDebouncer,
  createLeadingDebouncer,
} from '@/lib/realtime/debounce'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('createDebouncer', () => {
  it('collapses a burst into a single run', () => {
    const run = vi.fn()
    const debouncer = createDebouncer(250)

    // claimOrder issues two updates; the courier screen must refresh once.
    debouncer.schedule(run)
    debouncer.schedule(run)
    debouncer.schedule(run)
    expect(run).not.toHaveBeenCalled()

    vi.advanceTimersByTime(250)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('runs again once the window has elapsed', () => {
    const run = vi.fn()
    const debouncer = createDebouncer(200)

    debouncer.schedule(run)
    vi.advanceTimersByTime(200)
    debouncer.schedule(run)
    vi.advanceTimersByTime(200)

    expect(run).toHaveBeenCalledTimes(2)
  })

  it('keeps the last scheduled callback', () => {
    const first = vi.fn()
    const second = vi.fn()
    const debouncer = createDebouncer(100)

    debouncer.schedule(first)
    debouncer.schedule(second)
    vi.advanceTimersByTime(100)

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('cancel drops the pending run', () => {
    const run = vi.fn()
    const debouncer = createDebouncer(100)

    debouncer.schedule(run)
    debouncer.cancel()
    vi.advanceTimersByTime(1_000)

    expect(run).not.toHaveBeenCalled()
  })

  it('flush runs the pending callback immediately and only once', () => {
    const run = vi.fn()
    const debouncer = createDebouncer(100)

    debouncer.schedule(run)
    debouncer.flush()
    expect(run).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1_000)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('flush is a no-op with nothing pending', () => {
    const debouncer = createDebouncer(100)
    expect(() => debouncer.flush()).not.toThrow()
  })
})

describe('createLeadingDebouncer', () => {
  it('runs the first call at once', () => {
    const run = vi.fn()
    const debouncer = createLeadingDebouncer(250)

    debouncer.schedule(run)

    // A notification must repaint the screen now, not 250 ms later.
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('folds a burst into one more run when the window closes', () => {
    const first = vi.fn()
    const later = vi.fn()
    const latest = vi.fn()
    const debouncer = createLeadingDebouncer(250)

    debouncer.schedule(first)
    debouncer.schedule(later)
    debouncer.schedule(latest)
    expect(first).toHaveBeenCalledTimes(1)
    expect(latest).not.toHaveBeenCalled()

    // claimOrder writes twice: the trailing run picks up the second write.
    vi.advanceTimersByTime(250)
    expect(later).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledTimes(1)
  })

  it('refreshes at most once per window under a steady stream', () => {
    const run = vi.fn()
    const debouncer = createLeadingDebouncer(100)

    for (let tick = 0; tick < 10; tick += 1) {
      debouncer.schedule(run)
      vi.advanceTimersByTime(50)
    }
    vi.advanceTimersByTime(300)

    // 500 ms of events at 20/s: one leading run plus one per closed window.
    expect(run.mock.calls.length).toBeLessThanOrEqual(6)
    expect(run.mock.calls.length).toBeGreaterThanOrEqual(5)
  })

  it('is idle again after a quiet window', () => {
    const run = vi.fn()
    const debouncer = createLeadingDebouncer(100)

    debouncer.schedule(run)
    vi.advanceTimersByTime(100)
    debouncer.schedule(run)

    expect(run).toHaveBeenCalledTimes(2)
  })

  it('drops a queued run on cancel', () => {
    const run = vi.fn()
    const debouncer = createLeadingDebouncer(100)

    debouncer.schedule(run)
    debouncer.schedule(run)
    debouncer.cancel()
    vi.advanceTimersByTime(500)

    expect(run).toHaveBeenCalledTimes(1)
  })
})
