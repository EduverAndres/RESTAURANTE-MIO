import { NextResponse } from 'next/server'
import {
  buildHealthReport,
  healthHttpStatus,
  probeWithTimeout,
} from '@/lib/health/status'
import { createClient } from '@/lib/supabase/server'
import { version as APP_VERSION } from '@/package.json'

// Liveness/readiness probe for the platform and for uptime monitoring.
//
// Public and unauthenticated, so it answers with the closed report shape from
// `lib/health/status.ts` and nothing else: no environment values, no
// connection string, no PostgREST error text. Failures are logged
// server-side, where they belong.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Cheapest query that still proves the whole path works: the anon key is
 * accepted, PostgREST answers and RLS runs. `stores` has a public read
 * policy, so an empty result is a healthy answer — only an error is not.
 *
 * Runs under `HEALTH_PROBE_TIMEOUT_MS`: the signal is forwarded to PostgREST
 * so a hung connection is aborted and reported as `degraded` promptly,
 * instead of holding the probe open until something else gives up.
 */
async function databaseReachable(): Promise<boolean> {
  return probeWithTimeout(async (signal) => {
    try {
      const supabase = await createClient()
      const { error } = await supabase
        .from('stores')
        .select('id')
        .limit(1)
        .abortSignal(signal)
      if (error) {
        console.error('Health check: Supabase query failed', error)
        return false
      }
      return true
    } catch (error) {
      console.error('Health check: Supabase client unavailable', error)
      return false
    }
  })
}

export async function GET() {
  const report = buildHealthReport({
    databaseReachable: await databaseReachable(),
    version: APP_VERSION,
    checkedAt: new Date(),
  })

  return NextResponse.json(report, {
    status: healthHttpStatus(report.status),
    headers: {
      // A cached probe answer is worse than no probe at all.
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
