// Strict-Transport-Security for the whole site. Pure, and imported by
// next.config.ts with a relative path, so no `@/` imports here.
//
// It used to be `max-age=63072000; includeSubDomains; preload` from day one.
// Browsers ignore HSTS over plain http and on an IP, so it did nothing on the
// first deployment; the day the site moves to a domain with a certificate for
// the domain alone, `includeSubDomains` would make every subdomain without
// its own certificate (www, store subdomains) refuse to open, with no way to
// click through, for two years. `preload` asks browsers to hard-code all of
// that, and leaving the list again takes months.

/** Two years, the value the preload list expects if it is ever wanted. */
export const HSTS_MAX_AGE_SECONDS = 63_072_000

/**
 * Subdomains are covered only once store subdomains are switched on, which
 * already requires a wildcard certificate (NEXT_PUBLIC_STORE_SUBDOMAINS).
 * `preload` is never added here: submitting the domain to the preload list
 * is a deliberate, manual decision.
 */
export function hstsHeaderValue(
  env: Readonly<Record<string, string | undefined>>,
): string {
  const subdomains = env.NEXT_PUBLIC_STORE_SUBDOMAINS?.trim() === 'true'
  return subdomains
    ? `max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains`
    : `max-age=${HSTS_MAX_AGE_SECONDS}`
}
