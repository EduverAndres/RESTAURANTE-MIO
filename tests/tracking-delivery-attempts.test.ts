import { describe, expect, it } from 'vitest'
import {
  deliveryAttemptOutcome,
  MAX_DELIVERY_CODE_ATTEMPTS,
} from '@/lib/tracking/delivery-attempts'

const NOW = new Date('2026-09-23T12:00:00Z')

describe('deliveryAttemptOutcome', () => {
  it('allows five attempts', () => {
    expect(MAX_DELIVERY_CODE_ATTEMPTS).toBe(5)
  })

  it('is ok on a match with no lock', () => {
    expect(
      deliveryAttemptOutcome({
        attempts: 4,
        lockedAt: null,
        matches: true,
        now: NOW,
      }),
    ).toEqual({ kind: 'ok' })
  })

  it('counts a mismatch without locking below the limit', () => {
    expect(
      deliveryAttemptOutcome({
        attempts: 0,
        lockedAt: null,
        matches: false,
        now: NOW,
      }),
    ).toEqual({ kind: 'mismatch', attempts: 1, locked: false })
    expect(
      deliveryAttemptOutcome({
        attempts: 3,
        lockedAt: null,
        matches: false,
        now: NOW,
      }),
    ).toEqual({ kind: 'mismatch', attempts: 4, locked: false })
  })

  it('locks when the mismatch reaches the limit', () => {
    expect(
      deliveryAttemptOutcome({
        attempts: MAX_DELIVERY_CODE_ATTEMPTS - 1,
        lockedAt: null,
        matches: false,
        now: NOW,
      }),
    ).toEqual({
      kind: 'mismatch',
      attempts: MAX_DELIVERY_CODE_ATTEMPTS,
      locked: true,
    })
  })

  it('stays locked once locked, even on a match and long after', () => {
    const lockedAt = '2026-09-01T00:00:00Z'
    expect(
      deliveryAttemptOutcome({
        attempts: 5,
        lockedAt,
        matches: true,
        now: NOW,
      }),
    ).toEqual({ kind: 'locked' })
    expect(
      deliveryAttemptOutcome({
        attempts: 5,
        lockedAt,
        matches: false,
        now: NOW,
      }),
    ).toEqual({ kind: 'locked' })
  })

  it('treats a stored count already past the limit as a lock on mismatch', () => {
    expect(
      deliveryAttemptOutcome({
        attempts: MAX_DELIVERY_CODE_ATTEMPTS + 2,
        lockedAt: null,
        matches: false,
        now: NOW,
      }),
    ).toEqual({
      kind: 'mismatch',
      attempts: MAX_DELIVERY_CODE_ATTEMPTS + 3,
      locked: true,
    })
  })
})
