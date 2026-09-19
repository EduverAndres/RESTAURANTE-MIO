import { describe, expect, it } from 'vitest'
import {
  buildHealthReport,
  healthHttpStatus,
  probeWithTimeout,
  HEALTH_PROBE_TIMEOUT_MS,
  type HealthReport,
} from '@/lib/health/status'

const CHECKED_AT = new Date('2026-09-19T08:00:00.000Z')

function report(databaseReachable: boolean): HealthReport {
  return buildHealthReport({
    databaseReachable,
    version: '0.1.0',
    checkedAt: CHECKED_AT,
  })
}

describe('buildHealthReport', () => {
  it('reports ok with the version and an ISO timestamp when the database answers', () => {
    expect(report(true)).toEqual({
      status: 'ok',
      version: '0.1.0',
      checkedAt: '2026-09-19T08:00:00.000Z',
      checks: { database: 'ok' },
    })
  })

  it('reports degraded when the database does not answer', () => {
    expect(report(false)).toEqual({
      status: 'degraded',
      version: '0.1.0',
      checkedAt: '2026-09-19T08:00:00.000Z',
      checks: { database: 'down' },
    })
  })

  it('has no shape in which anything but the pinned keys can appear', () => {
    // The endpoint is public and unauthenticated: the report is a closed set
    // of keys, so no connection string, env value or driver error text can
    // ever reach it, whatever the caller passes in.
    expect(Object.keys(report(false)).sort()).toEqual([
      'checkedAt',
      'checks',
      'status',
      'version',
    ])
    expect(Object.keys(report(false).checks)).toEqual(['database'])
  })
})

describe('healthHttpStatus', () => {
  it('answers 200 while the app is healthy', () => {
    expect(healthHttpStatus('ok')).toBe(200)
  })

  it('answers 503 so a load balancer takes the instance out of rotation', () => {
    expect(healthHttpStatus('degraded')).toBe(503)
  })
})

describe('probeWithTimeout', () => {
  it('passes the probe answer through when it beats the deadline', async () => {
    await expect(probeWithTimeout(async () => true, 50)).resolves.toBe(true)
    await expect(probeWithTimeout(async () => false, 50)).resolves.toBe(false)
  })

  it('reports unreachable when the probe never answers', async () => {
    // A refused connection rejects fast; a black-holed one never answers at
    // all. Without a deadline the readiness probe hangs with it, which is
    // exactly the failure it exists to report.
    const start = Date.now()
    await expect(
      probeWithTimeout(() => new Promise<boolean>(() => {}), 20),
    ).resolves.toBe(false)
    expect(Date.now() - start).toBeLessThan(1000)
  })

  it('aborts the signal it handed the probe so the socket is released', async () => {
    let signal: AbortSignal | undefined
    await probeWithTimeout((probeSignal) => {
      signal = probeSignal
      return new Promise<boolean>(() => {})
    }, 20)
    expect(signal?.aborted).toBe(true)
  })

  it('leaves the signal untouched when the probe wins', async () => {
    let signal: AbortSignal | undefined
    await probeWithTimeout(async (probeSignal) => {
      signal = probeSignal
      return true
    }, 50)
    expect(signal?.aborted).toBe(false)
  })

  it('treats a rejected probe as unreachable rather than throwing', async () => {
    await expect(
      probeWithTimeout(async () => {
        throw new Error('ECONNREFUSED')
      }, 50),
    ).resolves.toBe(false)
  })

  it('budgets well under a typical probe interval by default', () => {
    expect(HEALTH_PROBE_TIMEOUT_MS).toBe(3000)
  })
})
