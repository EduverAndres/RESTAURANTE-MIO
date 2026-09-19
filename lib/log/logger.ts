import { REDACTED, redactContext, redactString, redactValue } from '@/lib/log/redact'

// Structured logging. One JSON object per line, so a log drain can index it
// instead of regex-ing prose, and so every field passes through
// `lib/log/redact.ts` on the way out.
//
// `event` is a stable dotted name (`wompi.webhook.store_failed`), not a
// sentence: it is what an alert is keyed on, and it must not change when the
// wording does. Everything variable belongs in `context`.
//
// Deliberately not a class and not a dependency: `console` is the only sink
// a serverless platform guarantees, and an error reporter (Sentry) can be
// attached at runtime with `setLogReporter` so nothing in `lib/` has to
// import the SDK.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type LogContext = Record<string, unknown>

export interface SerialisedError {
  name?: string
  message?: string
  stack?: string
  [key: string]: unknown
}

export interface LogRecord {
  level: LogLevel
  /** Stable dotted event name, e.g. `wompi.webhook.amount_mismatch`. */
  event: string
  /** ISO-8601 instant the record was built. */
  time: string
  context?: LogContext
  error?: SerialisedError
}

export interface BuildLogRecordInput {
  level: LogLevel
  event: string
  context?: LogContext
  error?: unknown
  time: Date
}

/** Receives every `error` record; wired to Sentry when a DSN is configured. */
export type LogReporter = (record: LogRecord, error?: unknown) => void

let reporter: LogReporter | null = null

/** Registers (or clears, with `null`) the error reporter. */
export function setLogReporter(next: LogReporter | null): void {
  reporter = next
}

/**
 * Turns whatever was thrown into a JSON-safe object.
 *
 * Supabase hands back plain objects (`code`, `message`, `details`, `hint`)
 * rather than `Error` instances, so both shapes have to survive this. The
 * stack is kept — it is the useful half of an error — but scrubbed, because
 * a stack frame can quote an argument.
 */
function serialiseError(error: unknown): SerialisedError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: redactString(error.message),
      ...(error.stack ? { stack: redactString(error.stack) } : {}),
    }
  }
  if (typeof error === 'string') return { message: redactString(error) }
  if (error && typeof error === 'object') {
    const redacted = redactValue(error)
    return typeof redacted === 'object' && redacted !== null
      ? (redacted as SerialisedError)
      : { message: String(redacted) }
  }
  return { message: error === undefined ? REDACTED : String(error) }
}

/** Pure: builds the record without writing it anywhere. */
export function buildLogRecord(input: BuildLogRecordInput): LogRecord {
  const context =
    input.context && Object.keys(input.context).length > 0
      ? redactContext(input.context)
      : undefined
  return {
    level: input.level,
    event: input.event,
    time: input.time.toISOString(),
    ...(context ? { context } : {}),
    ...(input.error !== undefined
      ? { error: serialiseError(input.error) }
      : {}),
  }
}

const CONSOLE_SINKS: Record<LogLevel, (line: string) => void> = {
  debug: (line) => console.debug(line),
  info: (line) => console.info(line),
  warn: (line) => console.warn(line),
  error: (line) => console.error(line),
}

function write(input: BuildLogRecordInput): void {
  const record = buildLogRecord(input)
  CONSOLE_SINKS[input.level](JSON.stringify(record))
  if (input.level !== 'error' || !reporter) return
  try {
    reporter(record, input.error)
  } catch {
    // A reporter that throws must never turn a logged failure into an
    // unhandled one: observability is never allowed to break the request it
    // is observing.
  }
}

export const logger = {
  debug(event: string, context?: LogContext): void {
    write({ level: 'debug', event, context, time: new Date() })
  },
  info(event: string, context?: LogContext): void {
    write({ level: 'info', event, context, time: new Date() })
  },
  warn(event: string, context?: LogContext, error?: unknown): void {
    write({ level: 'warn', event, context, error, time: new Date() })
  },
  error(event: string, context?: LogContext, error?: unknown): void {
    write({ level: 'error', event, context, error, time: new Date() })
  },
}
