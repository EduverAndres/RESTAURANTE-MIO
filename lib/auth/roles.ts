// Pure role/route rules shared by middleware, server helpers and tests.
// This module must stay free of server-only and Next.js imports.
import type { UserRole } from '@/types/app'

export const USER_ROLES: readonly UserRole[] = [
  'customer',
  'merchant',
  'courier',
  'admin',
]

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as string[]).includes(value)
}

const ROLE_HOME: Record<UserRole, string> = {
  customer: '/',
  merchant: '/dashboard',
  courier: '/courier',
  admin: '/admin',
}

/** Landing route for a role. Unknown roles land on the public home. */
export function getRoleHome(role: string | null | undefined): string {
  return isUserRole(role) ? ROLE_HOME[role] : '/'
}

interface ProtectedPrefix {
  prefix: string
  /** Empty list = any authenticated user. */
  roles: readonly UserRole[]
}

// Order matters only for readability; prefixes do not overlap.
const PROTECTED_PREFIXES: readonly ProtectedPrefix[] = [
  { prefix: '/dashboard', roles: ['merchant', 'admin'] },
  { prefix: '/courier', roles: ['courier', 'admin'] },
  { prefix: '/admin', roles: ['admin'] },
  { prefix: '/account', roles: [] },
  { prefix: '/checkout', roles: [] },
  { prefix: '/orders', roles: [] },
]

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/**
 * Roles allowed on a path: null when the path is public, an empty array when
 * it only requires authentication, otherwise the allowed roles.
 */
export function requiredRolesFor(pathname: string): UserRole[] | null {
  const match = PROTECTED_PREFIXES.find((entry) =>
    matchesPrefix(pathname, entry.prefix),
  )
  return match ? [...match.roles] : null
}

export type AccessDecision =
  | { allowed: true }
  | { allowed: false; reason: 'unauthenticated' | 'forbidden' }

/**
 * Decides whether a visitor with the given role (null = anonymous) may open
 * the path. Authenticated users whose role cannot be resolved are treated as
 * customers so they never gain elevated access by accident.
 */
export function canAccess(
  pathname: string,
  role: string | null | undefined,
): AccessDecision {
  const required = requiredRolesFor(pathname)
  if (required === null) return { allowed: true }
  if (role === null || role === undefined) {
    return { allowed: false, reason: 'unauthenticated' }
  }
  if (required.length === 0) return { allowed: true }

  const effectiveRole: UserRole = isUserRole(role) ? role : 'customer'
  return required.includes(effectiveRole)
    ? { allowed: true }
    : { allowed: false, reason: 'forbidden' }
}
