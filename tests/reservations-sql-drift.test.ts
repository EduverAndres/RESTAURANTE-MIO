// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { reservationSqlBlocks } from '@/lib/reservations/sql'

// The reservation vocabulary, the allowed transitions and the capacity rule
// live in TypeScript and in the migration. This checks the migration embeds
// the generated SQL verbatim, and pins the properties that keep bookings
// safe: one atomic writer, no API writes, realtime under RLS.

const path = (relative: string) =>
  fileURLToPath(new URL(relative, import.meta.url))
const SQL = readFileSync(
  path('../supabase/migrations/20261124000400_reservations.sql'),
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

describe('20261124000400_reservations.sql', () => {
  it('embeds every generated block verbatim', () => {
    for (const [name, sql] of Object.entries(reservationSqlBlocks())) {
      expect(block(name), name).toBe(sql)
    }
  })

  it('serialises bookings per store before checking capacity', () => {
    const fn = SQL.slice(SQL.indexOf('function public.create_reservation'))
    expect(fn.indexOf('for update')).toBeGreaterThan(-1)
    expect(fn.indexOf('for update')).toBeLessThan(fn.indexOf("'full'"))
  })

  it('lets only the server create reservations', () => {
    expect(SQL).toContain(
      'grant execute on function public.create_reservation(uuid, uuid, timestamptz, date, integer, text, text, text, text, integer) to service_role;',
    )
    expect(SQL).toContain(
      'revoke all on public.reservations from anon, authenticated;',
    )
    expect(SQL).toContain(
      'grant select on public.reservations to authenticated;',
    )
    const policies = SQL.match(/create policy "reservations: [^"]+"/g)
    expect(policies).toEqual([
      'create policy "reservations: customer read own"',
      'create policy "reservations: owner read"',
      'create policy "reservations: admin full access"',
    ])
  })

  it('keeps one live booking per customer, store and day', () => {
    expect(SQL).toMatch(
      /create unique index reservations_one_per_day\s+on public\.reservations \(store_id, customer_id, service_date\)/,
    )
  })

  it('publishes reservations to realtime', () => {
    expect(SQL).toContain(
      'alter publication supabase_realtime add table public.reservations;',
    )
  })

  it('follows the migration conventions and ships a rollback', () => {
    expect(SQL).toContain("set lock_timeout = '3s';")
    expect(SQL).toContain('reset lock_timeout;')
    expect(SQL).not.toMatch(/^\s*(begin|commit);/m)
    expect(
      existsSync(
        path('../supabase/rollbacks/20261124000400_reservations.down.sql'),
      ),
    ).toBe(true)
  })
})
