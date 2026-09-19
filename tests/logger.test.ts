import { afterEach, describe, expect, it, vi } from 'vitest'
import { REDACTED } from '@/lib/log/redact'
import {
  buildLogRecord,
  logger,
  setLogReporter,
  type LogRecord,
} from '@/lib/log/logger'

const TIME = new Date('2026-09-19T08:00:00.000Z')

afterEach(() => {
  vi.restoreAllMocks()
  setLogReporter(null)
})

describe('buildLogRecord', () => {
  it('produces a flat, JSON-serialisable record with level, event and time', () => {
    expect(
      buildLogRecord({
        level: 'info',
        event: 'wompi.webhook.applied',
        context: { orderId: 'o1' },
        time: TIME,
      }),
    ).toEqual({
      level: 'info',
      event: 'wompi.webhook.applied',
      time: '2026-09-19T08:00:00.000Z',
      context: { orderId: 'o1' },
    })
  })

  it('omits an empty context instead of logging an empty object', () => {
    const record = buildLogRecord({ level: 'warn', event: 'a.b', time: TIME })
    expect(record).toEqual({ level: 'warn', event: 'a.b', time: '2026-09-19T08:00:00.000Z' })
  })

  it('redacts the context it is given', () => {
    const record = buildLogRecord({
      level: 'error',
      event: 'table.order.denied',
      context: { token: 'qr-secret', orderId: 'o1' },
      time: TIME,
    })
    expect(record.context).toEqual({ token: REDACTED, orderId: 'o1' })
  })

  it('serialises an Error to name, message and stack', () => {
    const error = new TypeError('boom')
    const record = buildLogRecord({ level: 'error', event: 'a.b', error, time: TIME })
    expect(record.error?.name).toBe('TypeError')
    expect(record.error?.message).toBe('boom')
    expect(typeof record.error?.stack).toBe('string')
  })

  it('serialises a Supabase-style error object, which is not an Error', () => {
    const record = buildLogRecord({
      level: 'error',
      event: 'a.b',
      error: { code: '23505', message: 'duplicate key', details: null, hint: null },
      time: TIME,
    })
    expect(record.error).toMatchObject({ code: '23505', message: 'duplicate key' })
  })

  it('redacts secrets that leaked into an error message', () => {
    const record = buildLogRecord({
      level: 'error',
      event: 'a.b',
      error: new Error('rejected key sb_secret_2wLkQ9zXabc'),
      time: TIME,
    })
    expect(record.error?.message).toBe(`rejected key ${REDACTED}`)
  })

  it('is JSON-serialisable whatever it was handed', () => {
    const record = buildLogRecord({
      level: 'error',
      event: 'a.b',
      context: { when: TIME, size: BigInt(1) },
      error: 'plain string failure',
      time: TIME,
    })
    expect(() => JSON.stringify(record)).not.toThrow()
  })
})

describe('logger', () => {
  it('writes one JSON line to the console channel for the level', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logger.error('wompi.webhook.store_failed', { orderId: 'o1' })
    expect(spy).toHaveBeenCalledTimes(1)
    const parsed = JSON.parse(spy.mock.calls[0]?.[0] as string) as LogRecord
    expect(parsed.level).toBe('error')
    expect(parsed.event).toBe('wompi.webhook.store_failed')
    expect(parsed.context).toEqual({ orderId: 'o1' })
  })

  it('routes warnings to console.warn and info to console.info', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    logger.warn('a.b')
    logger.info('a.c')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(info).toHaveBeenCalledTimes(1)
  })

  it('hands errors to a registered reporter, redacted, and keeps writing the line', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const reporter = vi.fn()
    setLogReporter(reporter)
    const error = new Error('boom')
    logger.error('a.b', { token: 'qr-secret' }, error)
    expect(reporter).toHaveBeenCalledTimes(1)
    const [record, reported] = reporter.mock.calls[0] as [LogRecord, unknown]
    expect(record.context).toEqual({ token: REDACTED })
    expect(reported).toBe(error)
  })

  it('does not report anything below error level', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const reporter = vi.fn()
    setLogReporter(reporter)
    logger.warn('a.b')
    expect(reporter).not.toHaveBeenCalled()
  })

  it('never lets a broken reporter take down the caller', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    setLogReporter(() => {
      throw new Error('reporter down')
    })
    expect(() => logger.error('a.b')).not.toThrow()
    expect(spy).toHaveBeenCalled()
  })
})
