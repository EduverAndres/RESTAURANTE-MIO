// Health-report shaping and probe budgeting for `/api/health`. Everything
// that touches the network lives in the route; this module only decides what
// the answer looks like and how long the route may wait for it, so both
// contracts are testable without a database.
//
// The report is a closed set of keys on purpose. `/api/health` is public and
// unauthenticated, and a probe endpoint is a classic place to leak a
// connection string or a driver error message: by construction nothing but a
// boolean crosses this boundary, so there is nothing to redact.

export type HealthState = 'ok' | 'degraded'

export type CheckState = 'ok' | 'down'

export interface HealthReport {
  status: HealthState
  /** Deployed app version, from `package.json`. */
  version: string
  /** ISO-8601 instant the probe ran, so a cached answer is recognisable. */
  checkedAt: string
  checks: { database: CheckState }
}

export interface HealthInput {
  /** Whether the cheap Supabase query answered without an error. */
  databaseReachable: boolean
  version: string
  checkedAt: Date
}

/** The whole report, derived from the probe results and nothing else. */
export function buildHealthReport(input: HealthInput): HealthReport {
  return {
    status: input.databaseReachable ? 'ok' : 'degraded',
    version: input.version,
    checkedAt: input.checkedAt.toISOString(),
    checks: { database: input.databaseReachable ? 'ok' : 'down' },
  }
}

/**
 * 503 rather than 500 for a degraded app: the instance itself is running and
 * the answer is meaningful, it is the dependency that is unavailable, which
 * is what a load balancer or uptime probe expects before it stops routing.
 */
export function healthHttpStatus(status: HealthState): 200 | 503 {
  return status === 'ok' ? 200 : 503
}

/**
 * Upper bound for the database probe.
 *
 * A refused connection fails in milliseconds, but a black-holed one — a
 * dropped NAT entry, a pooler that accepted the socket and stopped answering,
 * a firewall that discards instead of rejecting — never fails at all. With no
 * deadline the probe hangs with it, and the load balancer waiting on
 * `/api/health` reads that as "still starting" rather than "take me out of
 * rotation": the exact failure the endpoint exists to report is the one it
 * cannot report. Three seconds is far longer than a healthy round trip and
 * well inside any usual probe interval, so it only ever fires on a real hang.
 */
export const HEALTH_PROBE_TIMEOUT_MS = 3000

/**
 * Runs a probe under a deadline, answering `false` if it does not finish in
 * time, rejects, or throws. The probe is handed an `AbortSignal` that fires on
 * timeout so it can cancel the underlying request instead of leaking a socket
 * for the rest of the process's life.
 *
 * Deliberately lives beside the report shaping rather than in the route: it
 * touches no network of its own, so the timeout decision is testable on its
 * own with a probe that simply never answers.
 */
export async function probeWithTimeout(
  probe: (signal: AbortSignal) => Promise<boolean>,
  timeoutMs: number = HEALTH_PROBE_TIMEOUT_MS,
): Promise<boolean> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<false>((resolve) => {
    timer = setTimeout(() => {
      controller.abort()
      resolve(false)
    }, timeoutMs)
  })
  try {
    return await Promise.race([
      probe(controller.signal).catch(() => false),
      deadline,
    ])
  } catch {
    // A probe that throws synchronously is as unreachable as one that rejects.
    return false
  } finally {
    clearTimeout(timer)
  }
}
