// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { CourierProfileFacts } from '@/lib/couriers/profile'
import {
  COURIER_ACTIVE_RULE,
  courierSqlBlocks,
  isCourierActive,
} from '@/lib/couriers/sql'
import { COURIER_STATUSES, VEHICLE_TYPES } from '@/lib/couriers/vocabulary'

// `is_active_courier()` opens the order pool inside RLS, so the approval rule
// exists in SQL and in TypeScript. This compares them over every combination
// and checks the migration embeds the generated SQL verbatim.

const TODAY = '2026-11-23'
const DATES = [null, '2026-11-22', TODAY, '2027-01-01'] as const

describe('the SQL mirror of isCourierActive', () => {
  it('agrees on every status, vehicle and document date', () => {
    for (const status of COURIER_STATUSES) {
      for (const vehicle_type of [...VEHICLE_TYPES, null]) {
        for (const license_expires_on of DATES) {
          for (const soat_expires_on of DATES) {
            const profile: Pick<
              CourierProfileFacts,
              | 'status'
              | 'vehicle_type'
              | 'license_expires_on'
              | 'soat_expires_on'
            > = { status, vehicle_type, license_expires_on, soat_expires_on }
            expect(
              COURIER_ACTIVE_RULE.matches(profile, TODAY),
              `${status}/${vehicle_type}/${license_expires_on}/${soat_expires_on}`,
            ).toBe(isCourierActive(profile, TODAY))
          }
        }
      }
    }
  })
})

const SQL = readFileSync(
  fileURLToPath(
    new URL(
      '../supabase/migrations/20261124000200_courier_profiles.sql',
      import.meta.url,
    ),
  ),
  'utf8',
).replace(/\r\n/g, '\n')

function block(name: string): string {
  const begin = `-- codegen:begin(${name})`
  const end = `-- codegen:end(${name})`
  const from = SQL.indexOf(begin)
  const to = SQL.indexOf(end)
  expect(from, `missing ${begin}`).toBeGreaterThan(-1)
  expect(to, `missing ${end}`).toBeGreaterThan(from)
  expect(SQL.indexOf(begin, from + 1), `duplicate ${begin}`).toBe(-1)
  return SQL.slice(from + begin.length, to).trim()
}

describe('20261124000200_courier_profiles.sql', () => {
  it('embeds every generated block verbatim', () => {
    for (const [name, sql] of Object.entries(courierSqlBlocks())) {
      expect(block(name), name).toBe(sql)
    }
  })

  it('opens the pool through is_active_courier in both order policies', () => {
    const policies = SQL.match(/alter policy "orders: [^"]+"/g) ?? []
    expect(policies).toEqual([
      'alter policy "orders: read as customer, owner or courier"',
      'alter policy "orders: courier claim or advance"',
    ])
    expect(SQL.match(/and public\.is_active_courier\(\)/g)).toHaveLength(2)
    expect(SQL).not.toMatch(/user_role_of\(auth\.uid\(\)\) = 'courier'/)
  })

  it('lets nobody but the server write a profile', () => {
    expect(SQL).toContain(
      'revoke all on public.courier_profiles from anon, authenticated;',
    )
    expect(SQL).toContain(
      'grant select on public.courier_profiles to authenticated;',
    )
    const policies = SQL.match(/create policy "courier_profiles: [^"]+"/g)
    expect(policies).toEqual([
      'create policy "courier_profiles: courier reads own"',
      'create policy "courier_profiles: admin full access"',
    ])
  })

  it('reads the date in Bogotá and keeps the function away from anon', () => {
    expect(SQL).toContain("(now() at time zone 'America/Bogota')::date")
    expect(SQL).toContain(
      'revoke all on function public.is_active_courier() from public, anon;',
    )
  })

  it('follows the migration conventions', () => {
    expect(SQL).toContain("set lock_timeout = '3s';")
    expect(SQL).toContain('reset lock_timeout;')
    expect(SQL).not.toMatch(/^\s*(begin|commit);/m)
  })
})
