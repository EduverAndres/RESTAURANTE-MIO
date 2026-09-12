import { describe, expect, it } from 'vitest'
import {
  ELAPSED_THRESHOLDS,
  ELAPSED_TONE_LABELS,
  elapsedTone,
  orderElapsedTone,
} from '@/lib/orders/elapsed-tone'

describe('elapsedTone', () => {
  const thresholds = { warn: 10, late: 20 }

  it('is fresh below the warn threshold', () => {
    expect(elapsedTone(0, thresholds)).toBe('fresh')
    expect(elapsedTone(9.9, thresholds)).toBe('fresh')
  })

  it('turns warn exactly at the warn threshold', () => {
    expect(elapsedTone(10, thresholds)).toBe('warn')
    expect(elapsedTone(19.9, thresholds)).toBe('warn')
  })

  it('turns late exactly at the late threshold and stays there', () => {
    expect(elapsedTone(20, thresholds)).toBe('late')
    expect(elapsedTone(600, thresholds)).toBe('late')
  })

  it('treats a negative age as fresh rather than inverting the scale', () => {
    expect(elapsedTone(-5, thresholds)).toBe('fresh')
  })
})

describe('ELAPSED_THRESHOLDS', () => {
  it('covers every active column', () => {
    expect(Object.keys(ELAPSED_THRESHOLDS).sort()).toEqual([
      'accepted',
      'pending',
      'picked_up',
      'preparing',
      'ready',
    ])
  })

  it('keeps warn below late in every column', () => {
    for (const thresholds of Object.values(ELAPSED_THRESHOLDS)) {
      expect(thresholds.warn).toBeLessThan(thresholds.late)
    }
  })

  it('gives an unanswered order the shortest fuse', () => {
    expect(ELAPSED_THRESHOLDS.pending.late).toBeLessThan(
      ELAPSED_THRESHOLDS.preparing.late,
    )
  })
})

describe('orderElapsedTone', () => {
  const now = new Date('2026-09-11T15:00:00.000Z')
  const minutesAgo = (minutes: number) =>
    new Date(now.getTime() - minutes * 60_000).toISOString()

  it('scores an order against the thresholds of its own column', () => {
    expect(orderElapsedTone('pending', minutesAgo(1), now)).toBe('fresh')
    expect(orderElapsedTone('pending', minutesAgo(4), now)).toBe('warn')
    expect(orderElapsedTone('pending', minutesAgo(12), now)).toBe('late')
    // The same twelve minutes are unremarkable for an order being cooked.
    expect(orderElapsedTone('preparing', minutesAgo(12), now)).toBe('fresh')
  })

  it('falls back to fresh for a terminal status with no column', () => {
    expect(orderElapsedTone('delivered', minutesAgo(600), now)).toBe('fresh')
    expect(orderElapsedTone('cancelled', minutesAgo(600), now)).toBe('fresh')
  })
})

describe('ELAPSED_TONE_LABELS', () => {
  it('names each tone in Spanish for screen readers', () => {
    expect(ELAPSED_TONE_LABELS.fresh).toMatch(/tiempo/i)
    expect(ELAPSED_TONE_LABELS.warn).toBeTruthy()
    expect(ELAPSED_TONE_LABELS.late).toMatch(/retraso|tarde/i)
  })
})
