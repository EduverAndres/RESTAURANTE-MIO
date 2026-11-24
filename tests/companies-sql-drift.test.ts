// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  holdsCorporateCredit,
  isBillableCharge,
  isStatementOverdue,
  tipExceeds,
} from '@/lib/companies/budget'
import {
  BILLABLE_CHARGE_SQL,
  HOLDS_CREDIT_SQL,
  STATEMENT_BECOMES_OVERDUE_SQL,
  STATEMENT_OVERDUE_SQL,
  TIP_EXCEEDS_SQL,
  companyRpcSqlBlocks,
  companySqlBlocks,
  corporateChargeSqlBlocks,
} from '@/lib/companies/sql'
import { statementDisplayStatus } from '@/lib/companies/statement'
import {
  CORPORATE_REJECTIONS,
  STATEMENT_STATUSES,
} from '@/lib/companies/vocabulary'
import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/types/app'

// Corporate credit is decided in SQL (under locks) and shown in TypeScript.
// This checks the migrations embed the generated SQL verbatim, that every
// predicate means the same in both languages (by evaluating the SQL text on
// the same rows), and pins the properties that keep the money safe.

const path = (relative: string) =>
  fileURLToPath(new URL(relative, import.meta.url))
const read = (relative: string) =>
  readFileSync(path(relative), 'utf8').replace(/\r\n/g, '\n')

const M0500 = read(
  '../supabase/migrations/20261124000500_payment_method_corporate.sql',
)
const M0600 = read('../supabase/migrations/20261124000600_companies.sql')
const M0700 = read('../supabase/migrations/20261124000700_company_rpcs.sql')
const M0800 = read(
  '../supabase/migrations/20261124000800_corporate_charges.sql',
)

function block(sql: string, name: string): string {
  const begin = `-- codegen:begin(${name})`
  const end = `-- codegen:end(${name})`
  const from = sql.indexOf(begin)
  const to = sql.indexOf(end)
  expect(from, `missing ${begin}`).toBeGreaterThan(-1)
  expect(to, `missing ${end}`).toBeGreaterThan(from)
  expect(sql.indexOf(begin, from + 1), `duplicate ${begin}`).toBe(-1)
  return sql.slice(from + begin.length, to).trim()
}

/**
 * Evaluates the small predicate language these rules use: clauses joined by
 * ` and `, each `x.col = 'v'`, `x.col <> 'v'`, `x.col in ('a', 'b')` or
 * `x.col > | < value-or-variable`. Anything else throws, so a rule written
 * outside this language cannot pass silently.
 */
function evalPredicate(
  sql: string,
  row: Record<string, string | number>,
  vars: Record<string, string | number> = {},
): boolean {
  return sql.split(' and ').every((clause) => {
    let match = /^\w+\.(\w+) (=|<>) '([^']*)'$/.exec(clause)
    if (match) {
      const equal = String(row[match[1]]) === match[3]
      return match[2] === '=' ? equal : !equal
    }
    match = /^\w+\.(\w+) in \(([^)]*)\)$/.exec(clause)
    if (match) {
      const values = match[2].split(', ').map((value) => value.slice(1, -1))
      return values.includes(String(row[match[1]]))
    }
    match = /^\w+\.(\w+) (>|<) (\w+)$/.exec(clause)
    if (match) {
      const left = row[match[1]]
      const right = match[3] in vars ? vars[match[3]] : Number(match[3])
      return match[2] === '>' ? left > right : left < right
    }
    throw new Error(`clause outside the drift language: ${clause}`)
  })
}

const METHODS: readonly PaymentMethod[] = [
  'cash',
  'wompi',
  'mercadopago',
  'mock',
  'corporate',
]
const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'pending',
  'paid',
  'failed',
  'refunded',
]
const ORDER_STATUSES: readonly OrderStatus[] = [
  'pending',
  'accepted',
  'preparing',
  'ready',
  'picked_up',
  'delivered',
  'cancelled',
]

describe('the SQL mirrors mean what the TypeScript means', () => {
  it('holds credit / is billable, on every order', () => {
    for (const payment_method of METHODS) {
      for (const payment_status of PAYMENT_STATUSES) {
        for (const status of ORDER_STATUSES) {
          const order = { payment_method, payment_status, status }
          const label = `${payment_method}/${payment_status}/${status}`
          expect(evalPredicate(HOLDS_CREDIT_SQL, order), label).toBe(
            holdsCorporateCredit(order),
          )
          expect(evalPredicate(BILLABLE_CHARGE_SQL, order), label).toBe(
            isBillableCharge(order),
          )
        }
      }
    }
  })

  it('overdue statements, on every status, total and date', () => {
    const today = '2026-11-23'
    for (const status of STATEMENT_STATUSES) {
      for (const total of [-100, 0, 1, 50_000]) {
        for (const due_on of ['2026-11-22', today, '2026-11-24']) {
          const statement = { status, total, due_on }
          const label = `${status}/${total}/${due_on}`
          expect(
            evalPredicate(STATEMENT_OVERDUE_SQL, statement, { v_today: today }),
            label,
          ).toBe(isStatementOverdue(statement, today))
          expect(
            evalPredicate(STATEMENT_BECOMES_OVERDUE_SQL, statement, {
              v_today: today,
            }),
            label,
          ).toBe(
            status === 'issued' &&
              statementDisplayStatus(statement, today) === 'overdue',
          )
        }
      }
    }
  })

  it('the tip cap, with the same whole-peso arithmetic', () => {
    for (const subtotal of [0, 1, 9_999, 33_333, 100_000]) {
      for (const tip of [0, 1, 3_333, 3_334, 10_000]) {
        for (const pct of [0, 5, 10, 30]) {
          const sql = TIP_EXCEEDS_SQL.replace('v_order.tip', String(tip))
            .replace('v_company.max_tip_pct', String(pct))
            .replace('v_order.subtotal', String(subtotal))
          expect(sql).toMatch(/^\d+ \* 100 > \d+ \* \d+$/)
          const [left, right] = sql.split(' > ')
          const product = (side: string) =>
            side.split(' * ').reduce((a, b) => a * Number(b), 1)
          expect(product(left) > product(right), sql).toBe(
            tipExceeds({ subtotal, tip }, pct),
          )
        }
      }
    }
  })
})

describe('the migrations embed every generated block verbatim', () => {
  it.each([
    ['0600', M0600, companySqlBlocks()],
    ['0700', M0700, companyRpcSqlBlocks()],
    ['0800', M0800, corporateChargeSqlBlocks()],
  ] as const)('%s', (_name, sql, blocks) => {
    for (const [name, text] of Object.entries(blocks)) {
      expect(block(sql, name), name).toBe(text)
    }
  })
})

describe('20261124000500_payment_method_corporate.sql', () => {
  it('only adds the enum value, outside any explicit transaction', () => {
    const statements = M0500.split('\n').filter(
      (line) => line.trim() !== '' && !line.startsWith('--'),
    )
    expect(statements).toEqual([
      "alter type public.payment_method add value if not exists 'corporate';",
    ])
  })

  it('ships a documented no-op rollback', () => {
    const down = read(
      '../supabase/rollbacks/20261124000500_payment_method_corporate.down.sql',
    )
    expect(down).toMatch(/cannot remove a value from an enum/)
    const statements = down
      .split('\n')
      .filter((line) => line.trim() !== '' && !line.startsWith('--'))
    expect(statements).toEqual(['select 1;'])
  })
})

describe('20261124000600_companies.sql', () => {
  it('ties the payment method to the company, added not valid and then validated', () => {
    expect(M0600).toMatch(
      /add constraint orders_corporate_company\s+check \(\(payment_method = 'corporate'\) = \(company_id is not null\)\)\s+not valid;/,
    )
    expect(M0600).toContain(
      'alter table public.orders validate constraint orders_corporate_company;',
    )
  })

  it('keeps one active membership per person and one live line per order and kind', () => {
    expect(M0600).toMatch(
      /create unique index company_members_one_active\s+on public\.company_members \(user_id\)\s+where active;/,
    )
    expect(M0600).toMatch(
      /create unique index company_statement_lines_once\s+on public\.company_statement_lines \(order_id, kind\)\s+where not voided;/,
    )
  })

  it('stores invitation tokens only as a SHA-256', () => {
    expect(M0600).toContain("check (token_hash ~ '^[0-9a-f]{64}$')")
    expect(M0600).not.toMatch(/\btoken text\b/)
    expect(M0700).toContain(
      "encode(sha256(convert_to(p_token, 'UTF8')), 'hex')",
    )
  })

  it('checks the NIT against its DIAN check digit', () => {
    expect(M0600).toContain(
      'constraint companies_dv_check check (dv = public.nit_check_digit(nit))',
    )
  })

  it('lets the API read, never write', () => {
    for (const table of [
      'companies',
      'company_invitations',
      'company_members',
      'order_corporate_billing',
      'company_statements',
      'company_statement_lines',
    ]) {
      expect(M0600).toContain(
        `revoke all on public.${table} from anon, authenticated;`,
      )
      expect(M0600).toContain(
        `grant select on public.${table} to authenticated;`,
      )
      expect(M0600).toContain(
        `alter table public.${table} enable row level security;`,
      )
    }
    const writes = M0600.match(/for (insert|update|delete) to/g)
    expect(writes).toBeNull()
  })

  it('lets the store owner read the billing snapshot of its own orders', () => {
    expect(M0600).toMatch(
      /create policy "order_corporate_billing: store owner read"\s+on public\.order_corporate_billing for select to authenticated\s+using \(public\.owns_store\(store_id\)\);/,
    )
  })

  it('protects the corporate columns from direct API writes', () => {
    for (const column of [
      'company_id',
      'company_member_id',
      'corporate_period',
      'corporate_reference',
    ]) {
      expect(M0600).toContain(`or new.${column} is distinct from old.${column}`)
    }
  })

  it('keeps the credit helpers away from the browser', () => {
    for (const signature of [
      'company_credit_used(uuid)',
      'company_member_spent(uuid, date)',
      'company_is_overdue(uuid)',
    ]) {
      expect(M0600).toContain(
        `revoke all on function public.${signature} from public, anon, authenticated;`,
      )
      expect(M0600).toContain(
        `grant execute on function public.${signature} to service_role;`,
      )
    }
  })

  it('reads dates in Bogotá', () => {
    expect(M0600).toContain(
      "select date_trunc('month', now() at time zone 'America/Bogota')::date;",
    )
    expect(M0600).toContain("(now() at time zone 'America/Bogota')::date")
  })
})

describe('20261124000700_company_rpcs.sql', () => {
  it('never lets anon call a company function', () => {
    const grants =
      M0700.match(/grant execute on function public\.[^;]+;/g) ?? []
    expect(grants.length).toBe(11)
    for (const grant of grants) expect(grant).toMatch(/ to authenticated;$/)
    const revokes = M0700.match(/revoke all on function public\.[^;]+;/g) ?? []
    expect(revokes.length).toBe(11)
    for (const revoke of revokes) expect(revoke).toMatch(/ from public, anon;$/)
  })

  it('serialises team changes on the company row and protects the last admin', () => {
    const fn = M0700.slice(M0700.indexOf('function public.set_company_member'))
    expect(fn.indexOf('for update')).toBeGreaterThan(-1)
    expect(fn.indexOf('for update')).toBeLessThan(fn.indexOf("'last_admin'"))
  })

  it('locks the invitation before spending one of its uses', () => {
    const fn = M0700.slice(
      M0700.indexOf('function public.accept_company_invitation'),
    )
    expect(fn.indexOf('for update')).toBeGreaterThan(-1)
    expect(fn.indexOf('for update')).toBeLessThan(fn.indexOf('uses = uses + 1'))
  })
})

describe('20261124000800_corporate_charges.sql', () => {
  const fn = M0800.slice(
    M0800.indexOf('function public.authorize_corporate_payment'),
    M0800.indexOf('function public.generate_company_statements'),
  )

  it('locks the order, then the company, before any check', () => {
    const orderLock = fn.indexOf(
      'from public.orders o where o.id = p_order_id for update',
    )
    const companyLock = fn.search(
      /from public\.companies c\s+where c\.id = v_order\.company_id\s+for update/,
    )
    expect(orderLock).toBeGreaterThan(-1)
    expect(companyLock).toBeGreaterThan(orderLock)
    expect(companyLock).toBeLessThan(fn.indexOf("'company_inactive'"))
  })

  it('refuses in the same order as authorizeCorporateCharge', () => {
    const positions = CORPORATE_REJECTIONS.map((reason) =>
      fn.indexOf(`'${reason}'`),
    )
    for (const position of positions) expect(position).toBeGreaterThan(-1)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('answers a repeat call for a paid order without writing', () => {
    const repeat = fn.indexOf("if v_order.payment_status = 'paid' then")
    expect(repeat).toBeGreaterThan(-1)
    expect(repeat).toBeLessThan(fn.indexOf('update public.orders'))
    expect(fn).toContain('on conflict (order_id) do nothing')
  })

  it('stamps the payment reference and the billing period', () => {
    expect(fn).toContain("v_ref := 'corp_' || v_order.short_code;")
    expect(fn).toMatch(
      /set payment_status = 'paid',\s+payment_ref = v_ref,\s+corporate_period = v_period/,
    )
  })

  it('only bills closed months, one run at a time', () => {
    expect(M0800).toContain('if p_period >= public.bogota_month_start() then')
    expect(M0800).toContain(
      "perform pg_advisory_xact_lock(hashtext('public.generate_company_statements'));",
    )
  })

  it('is callable by the service role only', () => {
    for (const signature of [
      'authorize_corporate_payment(uuid)',
      'generate_company_statements(date)',
      'refresh_overdue_company_statements()',
      'void_company_statement(uuid, text)',
    ]) {
      expect(M0800).toContain(
        `revoke all on function public.${signature} from public, anon, authenticated;`,
      )
      expect(M0800).toContain(
        `grant execute on function public.${signature} to service_role;`,
      )
    }
  })
})

describe('conventions', () => {
  it.each([
    ['20261124000600_companies', M0600],
    ['20261124000700_company_rpcs', M0700],
    ['20261124000800_corporate_charges', M0800],
  ])('%s sets a lock timeout and ships a rollback', (name, sql) => {
    expect(sql).toContain("set lock_timeout = '3s';")
    expect(sql).toContain('reset lock_timeout;')
    expect(sql).not.toMatch(/^\s*(begin|commit);/m)
    expect(existsSync(path(`../supabase/rollbacks/${name}.down.sql`))).toBe(
      true,
    )
  })

  it('every security definer function pins its search_path', () => {
    for (const sql of [M0600, M0700, M0800]) {
      const definers = sql.split('security definer').length - 1
      const pinned =
        sql.split('security definer\nset search_path = public').length - 1
      expect(pinned).toBe(definers)
    }
  })
})
