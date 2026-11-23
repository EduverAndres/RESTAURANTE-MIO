// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DEFAULT_AD_PLACEMENTS } from '@/lib/ads/pricing'
import { AD_PLACEMENTS } from '@/lib/ads/vocabulary'

// The properties of the ads migration that keep the money and the slots
// honest: who may call what, who may read what, one writer per decision, the
// fee inside the same settlement transaction, and a rollback that puts v3
// back exactly as it was.
const read = (relative: string) =>
  readFileSync(
    fileURLToPath(new URL(relative, import.meta.url)),
    'utf8',
  ).replace(/\r\n/g, '\n')

const MIGRATION = read('../supabase/migrations/20261124000900_ad_campaigns.sql')
const ROLLBACK_PATH = fileURLToPath(
  new URL(
    '../supabase/rollbacks/20261124000900_ad_campaigns.down.sql',
    import.meta.url,
  ),
)

/** The body of one function definition, up to its closing `$$;`. */
function fn(name: string): string {
  const from = MIGRATION.indexOf(`create or replace function public.${name}(`)
  expect(from, `missing function ${name}`).toBeGreaterThan(-1)
  const to = MIGRATION.indexOf('$$;', from)
  return MIGRATION.slice(from, to)
}

describe('20261124000900_ad_campaigns.sql: grants', () => {
  it('opens sponsored_stores to visitors, and only that', () => {
    expect(MIGRATION).toContain(
      'revoke all on function public.sponsored_stores(text) from public, anon, authenticated;',
    )
    expect(MIGRATION).toContain(
      'grant execute on function public.sponsored_stores(text) to anon, authenticated, service_role;',
    )
  })

  it('keeps approval and click counting on the server', () => {
    for (const signature of [
      'approve_ad_campaign(uuid, uuid)',
      'record_ad_click(uuid)',
    ]) {
      expect(MIGRATION).toContain(
        `revoke all on function public.${signature} from public, anon, authenticated;`,
      )
      expect(MIGRATION).toContain(
        `grant execute on function public.${signature} to service_role;`,
      )
      expect(MIGRATION).not.toMatch(
        new RegExp(
          `grant execute on function public\\.${signature.replace(/[()]/g, '\\$&')} to [^;]*(anon|authenticated)`,
        ),
      )
    }
  })

  it('keeps generate_payouts callable by the service role only', () => {
    expect(MIGRATION).toContain(
      'revoke all on function public.generate_payouts(date, date) from public, anon, authenticated;',
    )
    expect(MIGRATION).toContain(
      'grant execute on function public.generate_payouts(date, date) to service_role;',
    )
  })

  it('locks the trigger functions away from the API roles', () => {
    for (const name of ['guard_ad_campaign_update', 'log_ad_campaign_pause']) {
      expect(MIGRATION).toContain(
        `revoke all on function public.${name}() from public, anon, authenticated;`,
      )
    }
  })

  it('pins search_path on every security definer function', () => {
    for (const name of [
      'approve_ad_campaign',
      'sponsored_stores',
      'record_ad_click',
      'generate_payouts',
    ]) {
      const body = fn(name)
      expect(body, name).toContain('security definer')
      expect(body, name).toMatch(/set search_path = public/)
    }
  })

  it('is listed as intended in the function-grants audit', () => {
    expect(read('../scripts/audit-function-grants.sql')).toMatch(
      /\('sponsored_stores',\s+'[^']+'\)/,
    )
  })
})

describe('20261124000900_ad_campaigns.sql: who reads and writes', () => {
  it('lets anyone read the price list and nobody write it through the API', () => {
    expect(MIGRATION).toContain(
      'revoke all on public.ad_placements from anon, authenticated;',
    )
    expect(MIGRATION).toContain(
      'grant select on public.ad_placements to anon, authenticated;',
    )
  })

  it('lets owners read their own campaigns, admins read all, and nobody write', () => {
    for (const table of [
      'ad_campaigns',
      'ad_campaign_pauses',
      'ad_daily_stats',
    ]) {
      expect(MIGRATION).toContain(
        `revoke all on public.${table} from anon, authenticated;`,
      )
      expect(MIGRATION).toContain(
        `grant select on public.${table} to authenticated;`,
      )
      expect(MIGRATION).toContain(
        `alter table public.${table} enable row level security;`,
      )
      const policies = MIGRATION.match(
        new RegExp(
          `create policy "${table}: [^"]+"\\s+on public\\.${table} for (\\w+)`,
          'g',
        ),
      )
      expect(policies, table).toEqual([
        expect.stringContaining(`"${table}: owner read"`),
        expect.stringContaining(`"${table}: admin read"`),
      ])
      for (const policy of policies ?? []) expect(policy).toMatch(/for select$/)
    }
    expect(MIGRATION).not.toMatch(
      /grant (insert|update|delete|all)[^;]* to (anon|authenticated)/,
    )
  })
})

describe('20261124000900_ad_campaigns.sql: decisions', () => {
  it('seeds the price list with the launch prices of lib/ads/pricing.ts', () => {
    for (const placement of AD_PLACEMENTS) {
      const { daily_price, max_slots, min_days, max_days } =
        DEFAULT_AD_PLACEMENTS[placement]
      expect(MIGRATION, placement).toContain(
        `('${placement}', ${daily_price}, ${max_slots}, ${min_days}, ${max_days})`,
      )
    }
  })

  it('freezes the price and computes the quote in the database', () => {
    expect(MIGRATION).toContain(
      'total_price numeric generated always as (daily_price * (ends_on - starts_on + 1)) stored',
    )
    expect(fn('guard_ad_campaign_update')).toContain(
      'new.daily_price <> old.daily_price',
    )
  })

  it('serialises approvals per placement before counting the slots', () => {
    const body = fn('approve_ad_campaign')
    const lock = body.indexOf('from public.ad_placements pl')
    expect(lock).toBeGreaterThan(-1)
    expect(body.indexOf('for update', lock)).toBeGreaterThan(lock)
    expect(body.indexOf('for update', lock)).toBeLessThan(
      body.indexOf('generate_series'),
    )
    expect(body.indexOf("return 'full'")).toBeGreaterThan(
      body.indexOf('generate_series'),
    )
    // category_top counts its slots per category.
    expect(body).toContain(
      'lower(o.category_snapshot) = lower(v_campaign.category_snapshot)',
    )
  })

  it('logs pauses by trigger, one open pause per campaign', () => {
    expect(MIGRATION).toMatch(
      /create trigger ad_campaigns_log_pause\s+after update of status on public\.ad_campaigns/,
    )
    expect(MIGRATION).toMatch(
      /create unique index ad_campaign_pauses_open_key\s+on public\.ad_campaign_pauses \(campaign_id\)\s+where resumed_at is null;/,
    )
  })

  it('charges the ads fee inside generate_payouts and keeps its signature', () => {
    expect(MIGRATION).toMatch(
      /create or replace function public\.generate_payouts\(\s*p_period_start date,\s*p_period_end date\s*\)\s*returns table \(\s*payouts_created integer,\s*payouts_skipped integer,\s*refunds_reversed integer,\s*refunds_resolved integer\s*\)/,
    )
    expect(MIGRATION).toContain(
      'constraint payouts_ads_fee_not_negative check (ads_fee >= 0)',
    )
    const body = fn('generate_payouts')
    expect(body).toContain('ads_fees as (')
    expect(body).toContain('round(sum(c.daily_price * (')
    expect(body).toMatch(
      /plan_fee, ads_fee, delivery_and_tips, carried_in, net/,
    )
  })

  it('follows the migration conventions', () => {
    expect(MIGRATION).toContain("set lock_timeout = '3s';")
    expect(MIGRATION).toContain('reset lock_timeout;')
    expect(MIGRATION).not.toMatch(/^\s*(begin|commit);/m)
  })
})

describe('20261124000900_ad_campaigns.down.sql', () => {
  it('restores generate_payouts v3 verbatim from 20261124000100', () => {
    expect(existsSync(ROLLBACK_PATH)).toBe(true)
    const rollback = read(
      '../supabase/rollbacks/20261124000900_ad_campaigns.down.sql',
    )
    const v3 = read('../supabase/migrations/20261124000100_payout_carry.sql')
    const extract = (sql: string) => {
      const from = sql.indexOf(
        'create or replace function public.generate_payouts(',
      )
      const to = sql.indexOf(
        'grant execute on function public.generate_payouts(date, date) to service_role;',
        from,
      )
      return sql.slice(from, to)
    }
    expect(extract(rollback)).toBe(extract(v3))
    expect(rollback).not.toContain('ads_fee,')
  })

  it('drops everything the migration added, after restoring v3', () => {
    const rollback = read(
      '../supabase/rollbacks/20261124000900_ad_campaigns.down.sql',
    )
    for (const statement of [
      'drop function if exists public.record_ad_click(uuid);',
      'drop function if exists public.sponsored_stores(text);',
      'drop function if exists public.approve_ad_campaign(uuid, uuid);',
      'drop function if exists public.log_ad_campaign_pause();',
      'drop function if exists public.guard_ad_campaign_update();',
      'drop table if exists public.ad_daily_stats;',
      'drop table if exists public.ad_campaign_pauses;',
      'drop table if exists public.ad_campaigns;',
      'drop table if exists public.ad_placements;',
      'drop column if exists ads_fee;',
    ]) {
      expect(rollback).toContain(statement)
    }
    expect(rollback.indexOf('drop column if exists ads_fee;')).toBeGreaterThan(
      rollback.indexOf('create or replace function public.generate_payouts('),
    )
  })
})
