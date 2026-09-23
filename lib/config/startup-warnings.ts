/**
 * Configuration that is legitimate in development and quietly destructive in
 * production.
 *
 * Neither condition below is a bug, and neither can simply be forbidden: the
 * demo deployment genuinely runs the mock gateway, and a deployment outside
 * Colombia genuinely wants a different zone. What makes them dangerous is
 * that both fail *silently* — the app boots, serves traffic and looks
 * correct while recording the wrong day or approving charges nobody made.
 *
 * So this module does not block anything. It states, once per server start,
 * what the deployment has actually chosen, in terms of the consequence rather
 * than the variable name. `instrumentation.ts` logs each one at `error` level
 * on purpose: the logger only forwards `error` to Sentry, and a deployment
 * that did not intend these is exactly the one nobody is watching the console
 * of. A deployment that did intend them reads one line per cold start.
 *
 * Kept free of `process.env` so it can be unit tested with plain objects,
 * like `lib/env.server-schema.ts`.
 */

export type StartupWarningCode = 'time_zone_unset' | 'mock_payments_live'

export type StartupWarning = {
  code: StartupWarningCode
  message: string
}

export type StartupEnvSource = {
  NODE_ENV?: string | undefined
  TZ?: string | undefined
  PAYMENT_PROVIDER?: string | undefined
}

function isBlank(value: string | undefined): boolean {
  return !value || value.trim() === ''
}

export function startupWarnings(source: StartupEnvSource): StartupWarning[] {
  // Every check below describes a production-only hazard. In development the
  // machine's own zone is the right answer and the mock gateway is the point.
  if (source.NODE_ENV !== 'production') return []

  const warnings: StartupWarning[] = []

  // `lib/dates.ts` derives payout periods and the today/7d/30d metrics
  // windows from the server's local time. With no TZ the runtime is UTC, so
  // in Colombia (UTC-5) every order placed after 19:00 — dinner service, the
  // busiest hours a restaurant has — is filed under the following day.
  if (isBlank(source.TZ)) {
    warnings.push({
      code: 'time_zone_unset',
      message:
        'TZ is not set, so date-only logic (payout periods, the today/7d/30d ' +
        'metrics windows) runs in UTC. In a UTC-5 country every order after ' +
        '19:00 local is recorded under the next day. Set TZ to an IANA zone, ' +
        'for example America/Bogota.',
    })
  }

  // `lib/payments/mock.ts` stays available in production whenever this is
  // selected, and it approves every charge instantly. That is deliberate for
  // a demo and catastrophic if it was copied from `.env.example` by accident.
  if ((source.PAYMENT_PROVIDER ?? '').trim().toLowerCase() === 'mock') {
    warnings.push({
      code: 'mock_payments_live',
      message:
        'PAYMENT_PROVIDER is "mock": the simulated gateway approves every ' +
        'charge instantly and no money moves. Correct for a demo, wrong for ' +
        'anyone taking real orders. Set cash or wompi to disable it.',
    })
  }

  return warnings
}
