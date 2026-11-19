import { z } from 'zod'
import { storePublicUrl } from '@/lib/subdomain'

// Public environment variables. They are read with literal property access
// so Next.js can inline them into client bundles, and validated once at
// import time so a misconfigured deployment fails fast.
const publicEnvSchema = z
  .object({
    NEXT_PUBLIC_APP_NAME: z.string().min(1).default('Cerquita'),
    NEXT_PUBLIC_SITE_URL: z.url(),
    NEXT_PUBLIC_ROOT_DOMAIN: z.string().min(1),
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
    // Opt-in service worker registration outside production ("true"/"false").
    NEXT_PUBLIC_ENABLE_SW: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
    // Link stores as https://<slug>.<root domain> ("true"/"false"). Off by
    // default: it needs wildcard DNS and a wildcard certificate first.
    NEXT_PUBLIC_STORE_SUBDOMAINS: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
  })
  .refine(
    (value) =>
      Boolean(
        value.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        value.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      ),
    {
      message:
        'Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY',
      path: ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'],
    },
  )

export type PublicEnv = z.infer<typeof publicEnvSchema>

function emptyToUndefined(value: string | undefined): string | undefined {
  return value === '' ? undefined : value
}

const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_APP_NAME: emptyToUndefined(process.env.NEXT_PUBLIC_APP_NAME),
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: emptyToUndefined(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: emptyToUndefined(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  NEXT_PUBLIC_ENABLE_SW: emptyToUndefined(process.env.NEXT_PUBLIC_ENABLE_SW),
  NEXT_PUBLIC_STORE_SUBDOMAINS: emptyToUndefined(
    process.env.NEXT_PUBLIC_STORE_SUBDOMAINS,
  ),
})

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n')
  throw new Error(`Invalid public environment variables:\n${issues}`)
}

export const env: PublicEnv = parsed.data

export const APP_NAME = env.NEXT_PUBLIC_APP_NAME

/** Public link to a store's page, with this deployment's settings. */
export function storeUrl(slug: string): string {
  return storePublicUrl({
    slug,
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
    rootDomain: env.NEXT_PUBLIC_ROOT_DOMAIN,
    subdomains: env.NEXT_PUBLIC_STORE_SUBDOMAINS,
  })
}

// Key used by the browser and SSR clients. The publishable key is preferred;
// the legacy anon JWT is kept as a fallback.
export const SUPABASE_PUBLIC_KEY = (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as string
