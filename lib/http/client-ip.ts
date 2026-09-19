// Client address as seen through the proxy in front of us, for rate-limit
// keys only. Pure: takes a `Headers`, returns a string, imports nothing.
//
// These headers are attacker-controlled on a naked origin, so this is never
// an authorisation input — a forged `x-forwarded-for` buys an attacker a
// fresh rate-limit bucket, nothing more. On Vercel the platform overwrites
// `x-forwarded-for` with the real peer, which is what makes it usable at all;
// see `lib/http/request-origin.ts` for the same header-trust reasoning where
// the stakes are higher and the value has to be allow-listed.

function firstAddress(header: string | null): string | null {
  if (!header) return null
  for (const candidate of header.split(',')) {
    const value = candidate.trim().toLowerCase()
    if (value.length > 0) return value
  }
  return null
}

/** First hop of the forwarded chain, or null when there is no proxy header. */
export function clientIp(headers: Headers): string | null {
  return (
    firstAddress(headers.get('x-forwarded-for')) ??
    firstAddress(headers.get('x-real-ip'))
  )
}
