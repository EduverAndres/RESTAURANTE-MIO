import type { Instrumentation } from 'next'

// Next.js runs this once per server runtime, before any request is handled.
// It is the only place the app has that can attach process-wide observability,
// so it is where the optional Sentry reporter is installed.
//
// Everything here is dynamically imported: with no `SENTRY_DSN` configured
// `registerSentry` returns immediately and `@sentry/nextjs` is never loaded.
// The SDK's own `withSentryConfig` wrapper is deliberately not used — it
// exists for build-time source-map upload and auto-instrumentation, both of
// which need an auth token and extra Turbopack build surface for no benefit
// while the only goal is "errors reach Sentry when a DSN is set".

export async function register(): Promise<void> {
  // `server-only` modules cannot be imported from the browser bundle, and
  // this file is also evaluated for the edge runtime; both are servers, so
  // both get a reporter.
  if (process.env.NEXT_RUNTIME !== 'nodejs' && process.env.NEXT_RUNTIME !== 'edge') {
    return
  }
  const { registerSentry } = await import('@/lib/observability/sentry')
  await registerSentry()
}

/**
 * Errors Next.js catches while rendering or handling a request.
 *
 * Routed through the logger rather than Sentry's own `captureRequestError`
 * so that it passes through redaction like everything else, and so the same
 * record is written to the console whether Sentry is configured or not.
 *
 * `routePath` is the parameterised route (`/t/[slug]/mesa/[token]`), never
 * the resolved URL: the resolved one carries the QR table token, which must
 * not reach a log line or a third party.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const { logger } = await import('@/lib/log/logger')
  logger.error(
    'next.request_error',
    {
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
    },
    error,
  )
}
