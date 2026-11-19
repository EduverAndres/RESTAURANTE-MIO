import 'server-only'

import {
  AUTH_EMAIL_ACCOUNT_POLICY,
  AUTH_EMAIL_IP_POLICY,
  AUTH_LOGIN_ACCOUNT_POLICY,
  AUTH_LOGIN_IP_POLICY,
  AUTH_SIGNUP_IP_POLICY,
  rateLimitIdentifier,
  type RateLimitDecision,
  type RateLimitPolicy,
} from '@/lib/rate-limit/policy'
import {
  enforceRateLimit,
  postgresRateLimitStore,
  type RateLimitCheck,
  type RateLimitStore,
} from '@/lib/rate-limit/store'
import { createAdminClient } from '@/lib/supabase/admin'

export type AuthRateLimitAction = 'login' | 'signup' | 'email'

export interface AuthRequester {
  /** Normalised (trimmed, lower-case) email; hashed before storage. */
  email: string
  /** Client address, or null when no proxy header was present. */
  ip: string | null
}

const POLICIES: Record<
  AuthRateLimitAction,
  { account: RateLimitPolicy | null; ip: RateLimitPolicy }
> = {
  login: { account: AUTH_LOGIN_ACCOUNT_POLICY, ip: AUTH_LOGIN_IP_POLICY },
  // A sign-up for an email that already exists is answered by Supabase
  // without sending anything, so the per-address budget is the useful one.
  signup: { account: null, ip: AUTH_SIGNUP_IP_POLICY },
  email: { account: AUTH_EMAIL_ACCOUNT_POLICY, ip: AUTH_EMAIL_IP_POLICY },
}

/**
 * The budgets an auth action spends. Like the table-order checks, the
 * address budget is skipped when there is no proxy header rather than
 * putting every such request in one shared bucket.
 */
export function authRateLimitChecks(
  action: AuthRateLimitAction,
  requester: AuthRequester,
): RateLimitCheck[] {
  const { account, ip } = POLICIES[action]
  const checks: RateLimitCheck[] = []
  if (account) {
    checks.push({
      policy: account,
      identifier: rateLimitIdentifier('email', requester.email),
    })
  }
  if (requester.ip) {
    checks.push({
      policy: ip,
      identifier: rateLimitIdentifier('ip', requester.ip),
    })
  }
  return checks
}

// The admin client is built per hit, inside `consume`, so a missing secret
// key surfaces as a store failure and takes the limiter's fail-open path
// (logged) instead of breaking sign-in.
const lazyAdminStore: RateLimitStore = {
  consume: (check) =>
    postgresRateLimitStore(createAdminClient()).consume(check),
}

/** Records the attempt and says whether the auth action may proceed. */
export function checkAuthRateLimit(
  action: AuthRateLimitAction,
  requester: AuthRequester,
  store: RateLimitStore = lazyAdminStore,
): Promise<RateLimitDecision> {
  return enforceRateLimit(store, authRateLimitChecks(action, requester))
}
