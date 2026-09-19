import 'server-only'

import {
  parseServerEnv,
  pushConfiguredFrom,
  sentryConfiguredFrom,
  wompiConfiguredFrom,
  type ServerEnv,
} from '@/lib/env.server-schema'

// Server-only secrets. Every key is optional: a deployment with none of them
// set still builds and serves cash + mock payments exactly as before.
const parsed = parseServerEnv({
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER,
  WOMPI_PUBLIC_KEY: process.env.WOMPI_PUBLIC_KEY,
  WOMPI_PRIVATE_KEY: process.env.WOMPI_PRIVATE_KEY,
  WOMPI_EVENTS_SECRET: process.env.WOMPI_EVENTS_SECRET,
  WOMPI_INTEGRITY_SECRET: process.env.WOMPI_INTEGRITY_SECRET,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
  VAPID_SUBJECT: process.env.VAPID_SUBJECT,
  SENTRY_DSN: process.env.SENTRY_DSN,
  SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT,
})

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n')
  throw new Error(`Invalid server environment variables:\n${issues}`)
}

export const serverEnv: ServerEnv = parsed.data

/** Whether Wompi has every key it needs to create and verify payments. */
export function wompiConfigured(): boolean {
  return wompiConfiguredFrom(serverEnv)
}

/** Whether web push has every key it needs to send notifications. */
export function pushConfigured(): boolean {
  return pushConfiguredFrom(serverEnv)
}

/** Whether Sentry has a DSN to report errors to. */
export function sentryConfigured(): boolean {
  return sentryConfiguredFrom(serverEnv)
}
