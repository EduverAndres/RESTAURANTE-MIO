// @vitest-environment node
// This suite also reads a .sql file as text; under jsdom `import.meta.url`
// is not a file:// URL, so it cannot be resolved back to a path.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  UNAPPLIED_EVENT_REASONS,
  UNAPPLIED_EVENT_REASON_LABELS,
  UNAPPLIED_EVENT_REASON_TONES,
  classifyUnappliedEvent,
  unappliedEventCaseSql,
  unappliedEventWhereSql,
  type UnappliedEventInput,
} from '@/lib/payments/unapplied-events'

function event(overrides: Partial<UnappliedEventInput>): UnappliedEventInput {
  return {
    gateway_status: 'APPROVED',
    amount_in_cents: 1_000_000,
    order: { payment_status: 'paid', total: 10000 },
    ...overrides,
  }
}

describe('classifyUnappliedEvent', () => {
  it('reports an unknown order when the event resolved to none', () => {
    expect(classifyUnappliedEvent(event({ order: null }))).toBe('unknown_order')
  })

  it('reports an unknown order before anything else', () => {
    // No order means every later rule has nothing to compare against.
    expect(
      classifyUnappliedEvent(
        event({ order: null, gateway_status: 'DECLINED', amount_in_cents: 1 }),
      ),
    ).toBe('unknown_order')
  })

  it('reports an amount mismatch when cents and total disagree', () => {
    expect(
      classifyUnappliedEvent(
        event({ amount_in_cents: 999_999, order: { payment_status: 'paid', total: 10000 } }),
      ),
    ).toBe('amount_mismatch')
  })

  it('ignores the amount when the gateway did not send one', () => {
    expect(
      classifyUnappliedEvent(
        event({ amount_in_cents: null, order: { payment_status: 'paid', total: 10000 } }),
      ),
    ).toBe('apply_pending')
  })

  it('rounds the order total to cents before comparing', () => {
    expect(
      classifyUnappliedEvent(
        event({ amount_in_cents: 1_050_050, order: { payment_status: 'paid', total: 10500.499 } }),
      ),
    ).toBe('apply_pending')
  })

  it('reports an approved charge that never reached the order', () => {
    expect(
      classifyUnappliedEvent(
        event({
          gateway_status: 'APPROVED',
          order: { payment_status: 'pending', total: 10000 },
        }),
      ),
    ).toBe('approved_not_paid')
  })

  it('reports a declined charge whose order is still awaiting payment', () => {
    expect(
      classifyUnappliedEvent(
        event({
          gateway_status: 'DECLINED',
          order: { payment_status: 'pending', total: 10000 },
        }),
      ),
    ).toBe('declined_still_open')
  })

  it('treats a gateway ERROR like a decline', () => {
    expect(
      classifyUnappliedEvent(
        event({
          gateway_status: 'ERROR',
          order: { payment_status: 'pending', total: 10000 },
        }),
      ),
    ).toBe('declined_still_open')
  })

  it('falls back to apply_pending when the event and the order agree', () => {
    expect(classifyUnappliedEvent(event({}))).toBe('apply_pending')
  })

  it('does not flag a declined event whose order already moved on', () => {
    expect(
      classifyUnappliedEvent(
        event({
          gateway_status: 'DECLINED',
          order: { payment_status: 'failed', total: 10000 },
        }),
      ),
    ).toBe('apply_pending')
  })
})

describe('reason metadata', () => {
  it('labels and tones every reason', () => {
    for (const reason of UNAPPLIED_EVENT_REASONS) {
      expect(UNAPPLIED_EVENT_REASON_LABELS[reason]).toBeTruthy()
      expect(UNAPPLIED_EVENT_REASON_TONES[reason]).toBeTruthy()
    }
  })

  it('orders the reasons by how much money they can cost', () => {
    expect(UNAPPLIED_EVENT_REASONS[0]).toBe('approved_not_paid')
  })
})

// ---------------------------------------------------------------------------
// The SQL audit script and the admin page must classify identically, so the
// script embeds generated blocks and this test is the thing that fails when
// one of them drifts.
// ---------------------------------------------------------------------------
const SQL_PATH = fileURLToPath(
  new URL('../scripts/audit-unapplied-events.sql', import.meta.url),
)

/** Windows checks this file out with CRLF; compare on LF only. */
function readSql(): string {
  return readFileSync(SQL_PATH, 'utf8').replace(/\r\n/g, '\n')
}

function block(name: string): string {
  const sql = readSql()
  const begin = `-- codegen:begin(${name})`
  const end = `-- codegen:end(${name})`
  const from = sql.indexOf(begin)
  const to = sql.indexOf(end)
  expect(from, `missing ${begin}`).toBeGreaterThan(-1)
  expect(to, `missing ${end}`).toBeGreaterThan(from)
  return sql.slice(from + begin.length, to).trim()
}

describe('audit-unapplied-events.sql', () => {
  it('embeds the generated case expression verbatim', () => {
    expect(block('classification')).toBe(unappliedEventCaseSql())
  })

  it('embeds the generated filter verbatim', () => {
    expect(block('filter')).toBe(unappliedEventWhereSql())
  })
})
