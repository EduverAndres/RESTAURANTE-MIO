// @vitest-environment node
// Reads a .sql file as text; under jsdom `import.meta.url` is not a file://
// URL, so it cannot be resolved back to a path.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  AD_BILLED_STATUSES,
  AD_HOLDING_STATUSES,
  AD_PAUSE_REASONS,
  AD_PAUSE_REASON_LABELS,
  AD_PLACEMENTS,
  AD_PLACEMENT_DESCRIPTIONS,
  AD_PLACEMENT_LABELS,
  AD_STATUSES,
  AD_STATUS_LABELS,
  AD_STATUS_TONES,
  AD_TRANSITION_PAIRS,
  adTransitionPairsSql,
  adVocabularySqlBlocks,
  canTransition,
  isAdPlacement,
} from '@/lib/ads/vocabulary'

// The placements, statuses, pause reasons and allowed transitions live in
// lib/ads/vocabulary.ts and in the migration's checks and trigger. A value
// added on one side only would pass every type check and then fail an admin
// mid-approval with a constraint violation; this is the test that keeps the
// two sides one list.

const SQL = readFileSync(
  fileURLToPath(
    new URL(
      '../supabase/migrations/20261124000900_ad_campaigns.sql',
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

describe('20261124000900_ad_campaigns.sql vocabulary', () => {
  it('embeds every generated vocabulary block verbatim', () => {
    for (const [name, sql] of Object.entries(adVocabularySqlBlocks())) {
      expect(block(name), name).toBe(sql)
    }
  })

  it('guards the status with exactly the transition pairs', () => {
    expect(block('ad_transitions')).toBe(adTransitionPairsSql())
    expect(adTransitionPairsSql()).toContain("('requested', 'active')")
  })
})

describe('the ads vocabulary', () => {
  it('labels every placement and every status a person can read', () => {
    for (const placement of AD_PLACEMENTS) {
      expect(AD_PLACEMENT_LABELS[placement]).toBeTruthy()
      expect(AD_PLACEMENT_DESCRIPTIONS[placement]).toBeTruthy()
    }
    for (const status of [...AD_STATUSES, 'scheduled', 'finished'] as const) {
      expect(AD_STATUS_LABELS[status]).toBeTruthy()
      expect(AD_STATUS_TONES[status]).toBeTruthy()
    }
    for (const reason of AD_PAUSE_REASONS) {
      expect(AD_PAUSE_REASON_LABELS[reason]).toBeTruthy()
    }
  })

  it('recognises placements and nothing else', () => {
    expect(isAdPlacement('home_featured')).toBe(true)
    expect(isAdPlacement('banner')).toBe(false)
    expect(isAdPlacement(null)).toBe(false)
  })

  it('only lets a request be decided once, and an ended campaign stay ended', () => {
    expect(canTransition('requested', 'active')).toBe(true)
    expect(canTransition('requested', 'cancelled')).toBe(true)
    expect(canTransition('active', 'paused')).toBe(true)
    expect(canTransition('paused', 'active')).toBe(true)
    expect(canTransition('paused', 'ended')).toBe(true)
    for (const to of AD_STATUSES) {
      expect(canTransition('ended', to), `ended -> ${to}`).toBe(false)
      expect(canTransition('rejected', to), `rejected -> ${to}`).toBe(false)
      expect(canTransition('cancelled', to), `cancelled -> ${to}`).toBe(false)
    }
    // A merchant cannot cancel what is already on the air: the days ran.
    expect(canTransition('active', 'cancelled')).toBe(false)
    expect(canTransition('requested', 'paused')).toBe(false)
  })

  it('has no duplicate or self transition', () => {
    const keys = AD_TRANSITION_PAIRS.map(([a, b]) => `${a}->${b}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(AD_TRANSITION_PAIRS.every(([a, b]) => a !== b)).toBe(true)
  })

  it('charges every approved status and holds a slot only while it can run', () => {
    expect([...AD_BILLED_STATUSES].sort()).toEqual(
      ['active', 'ended', 'paused'].sort(),
    )
    expect([...AD_HOLDING_STATUSES].sort()).toEqual(['active', 'paused'])
  })
})
