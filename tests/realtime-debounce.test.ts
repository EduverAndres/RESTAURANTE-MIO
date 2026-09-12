import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDebouncer } from '@/lib/realtime/debounce'

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
