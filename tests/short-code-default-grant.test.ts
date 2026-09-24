// @vitest-environment node
// Reads .sql files as text; under jsdom `import.meta.url` is not a file://
// URL, so it cannot be resolved back to a path.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function read(relative: string): string {
  return readFileSync(
    fileURLToPath(new URL(relative, import.meta.url)),
    'utf8',
  ).replace(/\r\n/g, '\n')
}

/**
 * orders.short_code has DEFAULT next_short_code(). A column DEFAULT runs as
 * the inserting role, so the browser roles must be able to execute that
 * function or no customer or guest can place an order -- which is exactly
 * what happened when 20260919000700 revoked it. This suite cannot reach the
 * database; it pins the two files that keep the grant from being revoked
 * again "for hygiene".
 */
describe('next_short_code stays executable by the inserting roles', () => {
  it('the column default still points at next_short_code', () => {
    const sql = read('../supabase/migrations/20260910000600_orders_short_code_default.sql')
    expect(sql).toMatch(/alter column short_code set default public\.next_short_code\(\)/)
  })

  it('a migration after the revoke grants it back to anon and authenticated', () => {
    const sql = read('../supabase/migrations/20260919000900_next_short_code_column_default_grant.sql')
    expect(sql).toMatch(
      /grant execute on function public\.next_short_code\(\)\s+to anon, authenticated;/,
    )
  })

  it('the grant migration sorts after the revoke, so a fresh database ends open', () => {
    expect('20260919000900' > '20260919000700').toBe(true)
  })

  it('the function-grant audit lists next_short_code as intentional', () => {
    const audit = read('../scripts/audit-function-grants.sql')
    const allowlist = audit.slice(
      audit.indexOf('with intentional'),
      audit.indexOf(')\nselect'),
    )
    expect(allowlist).toMatch(/'next_short_code'/)
    expect(allowlist).toMatch(/column default|DEFAULT/i)
  })
})
