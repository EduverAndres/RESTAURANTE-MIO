// @vitest-environment node
// Reads a .sql file as text; under jsdom `import.meta.url` is not a file://
// URL, so it cannot be resolved back to a path.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  REFUND_METHODS,
  REFUND_METHOD_LABELS,
  REFUND_REASONS,
  REFUND_REASON_LABELS,
  sqlValueList,
} from '@/lib/refunds/vocabulary'

// ---------------------------------------------------------------------------
// `lib/refunds/vocabulary.ts` is the single source the UI and the table's
// `check` constraints are written from. That claim was previously only a doc
// comment: the constraint was hand-written literals, so a reason added to the
// module would have passed every check in the codebase and then failed a
// merchant mid-refund with a constraint violation. This is the test that
// makes the claim true.
// ---------------------------------------------------------------------------
const SQL_PATH = fileURLToPath(
  new URL('../supabase/migrations/20260919000400_refunds.sql', import.meta.url),
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

describe('20260919000400_refunds.sql', () => {
  it('constrains reason to exactly the vocabulary', () => {
    expect(block('refund_reasons')).toBe(sqlValueList(REFUND_REASONS))
  })

  it('constrains method to exactly the vocabulary', () => {
    expect(block('refund_methods')).toBe(sqlValueList(REFUND_METHODS))
  })
})

describe('the vocabulary itself', () => {
  it('labels every value the UI can offer', () => {
    for (const reason of REFUND_REASONS) {
      expect(REFUND_REASON_LABELS[reason]).toBeTruthy()
    }
    for (const method of REFUND_METHODS) {
      expect(REFUND_METHOD_LABELS[method]).toBeTruthy()
    }
  })

  it('quotes values the way a SQL list needs them', () => {
    expect(sqlValueList(['a', 'b'])).toBe("'a', 'b'")
  })
})
