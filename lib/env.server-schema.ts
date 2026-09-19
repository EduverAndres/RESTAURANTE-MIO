import { z } from 'zod'

// Pure zod schema for server-only secrets. Every key is optional so the app
// builds and runs with nothing configured (cash + mock keep working); the
// `*ConfiguredFrom` predicates decide whether a feature can be offered.
// Kept free of `process.env` so it can be unit tested with plain objects.
export const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  PAYMENT_PROVIDER: z.string().min(1).optional(),
  WOMPI_PUBLIC_KEY: z.string().startsWith('pub_').optional(),
  WOMPI_PRIVATE_KEY: z.string().startsWith('prv_').optional(),
  WOMPI_EVENTS_SECRET: z.string().min(1).optional(),
  WOMPI_INTEGRITY_SECRET: z.string().min(1).optional(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().startsWith('mailto:').optional(),
  // `https://<publicKey>@<host>/<projectId>`, as Sentry prints it. Checked
  // here rather than left to the SDK because an invalid DSN only disables
  // Sentry with a warning nobody reads: a deployment that believes it has
  // error reporting and has not is worse than one that fails to boot.
  SENTRY_DSN: z
    .string()
    .regex(/^https?:\/\/[^@\s/]+@[^\s/]+\/\d+$/, 'Must be a Sentry DSN')
    .optional(),
  SENTRY_ENVIRONMENT: z.string().min(1).optional(),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>
export type ServerEnvSource = Partial<Record<keyof ServerEnv, string | undefined>>

export function parseServerEnv(source: ServerEnvSource) {
  return serverEnvSchema.safeParse(source)
}

/** True once every key Wompi needs to create and verify payments is set. */
export function wompiConfiguredFrom(source: ServerEnvSource): boolean {
  return Boolean(
    source.WOMPI_PUBLIC_KEY &&
      source.WOMPI_PRIVATE_KEY &&
      source.WOMPI_EVENTS_SECRET &&
      source.WOMPI_INTEGRITY_SECRET,
  )
}

/** True once every key web push needs to send notifications is set. */
export function pushConfiguredFrom(source: ServerEnvSource): boolean {
  return Boolean(
    source.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      source.VAPID_PRIVATE_KEY &&
      source.VAPID_SUBJECT,
  )
}

/**
 * True once Sentry has a destination to send to. The DSN is the only
 * required key — `SENTRY_ENVIRONMENT` merely labels the events — so error
 * reporting is exactly one variable away from live, and its absence leaves
 * the SDK initialised as a no-op rather than branching the app.
 */
export function sentryConfiguredFrom(source: ServerEnvSource): boolean {
  return Boolean(source.SENTRY_DSN)
}
