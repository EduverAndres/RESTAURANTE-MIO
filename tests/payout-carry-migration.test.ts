// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The carry is money logic inside one transaction; these are the properties
// of the migration that keep it from withholding a debt twice or never.
const read = (relative: string) =>
  readFileSync(
    fileURLToPath(new URL(relative, import.meta.url)),
    'utf8',
  ).replace(/\r\n/g, '\n')

const MIGRATION = read('../supabase/migrations/20261124000100_payout_carry.sql')
const ROLLBACK_PATH = fileURLToPath(
  new URL(
    '../supabase/rollbacks/20261124000100_payout_carry.down.sql',
    import.meta.url,
  ),
)

describe('20261124000100_payout_carry.sql', () => {
  it('keeps the function signature, so callers and types do not change', () => {
    expect(MIGRATION).toMatch(
      /create or replace function public\.generate_payouts\(\s*p_period_start date,\s*p_period_end date\s*\)\s*returns table \(\s*payouts_created integer,\s*payouts_skipped integer,\s*refunds_reversed integer,\s*refunds_resolved integer\s*\)/,
    )
  })

  it('locks the carryable debts before the statement that reads them', () => {
    const lock = MIGRATION.indexOf('for update;')
    const query = MIGRATION.indexOf('return query')
    expect(lock).toBeGreaterThan(-1)
    expect(lock).toBeLessThan(query)
  })

  it('re-checks that a debt is still open when stamping it', () => {
    expect(MIGRATION).toMatch(
      /update public\.payouts prev\s+set carried_into_payout_id = i\.id[\s\S]*?and prev\.carried_into_payout_id is null\s+and prev\.status = 'pending'/,
    )
  })

  it('refuses to mark a carried debt as paid', () => {
    expect(MIGRATION).toContain(
      "check (carried_into_payout_id is null or status = 'pending')",
    )
    expect(MIGRATION).toContain('check (carried_in <= 0)')
  })

  it('stays callable by the service role only', () => {
    expect(MIGRATION).toContain(
      'revoke all on function public.generate_payouts(date, date) from public;',
    )
    expect(MIGRATION).toContain(
      'grant execute on function public.generate_payouts(date, date) to service_role;',
    )
  })

  it('follows the migration conventions', () => {
    expect(MIGRATION).toContain("set lock_timeout = '3s';")
    expect(MIGRATION).toContain('reset lock_timeout;')
    expect(MIGRATION).not.toMatch(/^\s*(begin|commit);/m)
  })

  it('ships a rollback that restores the previous function and drops the columns', () => {
    expect(existsSync(ROLLBACK_PATH)).toBe(true)
    const rollback = read(
      '../supabase/rollbacks/20261124000100_payout_carry.down.sql',
    )
    expect(rollback).toContain(
      'create or replace function public.generate_payouts(',
    )
    expect(rollback).not.toContain('carried_into_payout_id = i.id')
    for (const column of [
      'carried_into_payout_id',
      'carried_in',
      'delivery_and_tips',
    ]) {
      expect(rollback).toContain(
        `drop column if exists ${column};`.replace(';', ''),
      )
    }
  })
})
