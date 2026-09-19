import 'server-only'

import { sentryConfigured, serverEnv } from '@/lib/env.server'
import { setLogReporter, type LogRecord } from '@/lib/log/logger'

// Optional error reporting, wired exactly like Wompi and web push: every key
// is optional, a `*Configured` predicate decides whether the feature is live,
// and with nothing set the app builds, boots and serves as before. The only
// difference is that there is no user-visible feature to hide — an
// unconfigured Sentry simply means `logger.error` writes its line and stops
// there.
//
// The SDK is imported dynamically so that a deployment without a DSN never
// loads it at all.

let started = false

/**
 * Serialised copies only.
 *
 * `Sentry.captureException(error)` would ship the original error object,
 * which has never been through `lib/log/redact.ts` — its message, its
 * properties and its stack frames can quote a service-role key or a QR
 * token, and the whole point of the redaction layer is that nothing skips
 * it. So the already-redacted record is what gets sent.
 *
 * The cost is that Sentry groups by our event name rather than by its own
 * stack fingerprint. That is an acceptable trade and arguably better here:
 * event names like `wompi.webhook.store_failed` are stable identifiers
 * chosen for exactly this purpose, while a stack fingerprint drifts with
 * every refactor. The redacted stack still travels with the event.
 */
function reportRecord(
  captureMessage: (typeof import('@sentry/nextjs'))['captureMessage'],
  record: LogRecord,
): void {
  captureMessage(record.event, {
    level: 'error',
    tags: { event: record.event },
    contexts: {
      log: { time: record.time, ...(record.context ?? {}) },
      ...(record.error ? { error: { ...record.error } } : {}),
    },
  })
}

/**
 * Initialises Sentry and points the logger at it. A no-op without a DSN, and
 * idempotent: `register()` runs once per runtime, but a re-entrant import
 * must not install a second reporter.
 */
export async function registerSentry(): Promise<void> {
  if (started || !sentryConfigured()) return
  started = true

  const Sentry = await import('@sentry/nextjs')
  Sentry.init({
    dsn: serverEnv.SENTRY_DSN,
    environment: serverEnv.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    // Errors only. Tracing is a separate cost decision and a separate volume
    // of data; turn it on deliberately, not as a side effect of wanting
    // stack traces.
    tracesSampleRate: 0,
    // Never let the SDK attach request bodies, cookies or user identifiers on
    // its own. Everything this app reports is chosen explicitly above.
    sendDefaultPii: false,
  })

  setLogReporter((record) => reportRecord(Sentry.captureMessage, record))
}
