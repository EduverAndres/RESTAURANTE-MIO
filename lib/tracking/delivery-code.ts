// The four-digit handover code. The customer reads it out at the door and
// the courier types it in; the server compares. Pure so both the action and
// the tests can exercise it.
import { z } from 'zod'

const CODE_LENGTH = 4
const CODE_SPACE = 10 ** CODE_LENGTH
/** Draws before giving up on a random source that never yields a valid code. */
const MAX_DRAWS = 64

function isAllEqual(code: string): boolean {
  return new Set(code).size === 1
}

/** 0123, 1234, ... and their reverses: easy to guess, easy to mis-hear. */
function isSequential(code: string): boolean {
  let ascending = true
  let descending = true
  for (let i = 1; i < code.length; i += 1) {
    const step = Number(code[i]) - Number(code[i - 1])
    if (step !== 1) ascending = false
    if (step !== -1) descending = false
  }
  return ascending || descending
}

function isAcceptable(code: string): boolean {
  return !isAllEqual(code) && !isSequential(code)
}

function drawCode(random: () => number): string {
  const raw = random()
  const unit = Number.isFinite(raw) ? Math.min(0.999999, Math.max(0, raw)) : 0
  return String(Math.floor(unit * CODE_SPACE)).padStart(CODE_LENGTH, '0')
}

/**
 * Four zero-padded digits that are neither all equal nor a run. `random`
 * is injectable for tests; a source that never produces an acceptable code
 * falls back to a fixed, well-formed value rather than looping forever.
 */
export function generateDeliveryCode(
  random: () => number = Math.random,
): string {
  for (let i = 0; i < MAX_DRAWS; i += 1) {
    const code = drawCode(random)
    if (isAcceptable(code)) return code
  }
  return '2048'
}

function digitsOf(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Compares what the courier typed against the stored code. Length is checked
 * first, then every character is XOR-ed so a mismatch costs the same time
 * wherever it sits. `expected` is null when no code was ever issued: nothing
 * can match it.
 */
export function deliveryCodeMatches(
  expected: string | null,
  entered: string,
): boolean {
  if (expected === null) return false
  const candidate = digitsOf(entered)
  if (candidate.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ candidate.charCodeAt(i)
  }
  return diff === 0
}

export const deliveryCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{4}$/, 'Ingresa los 4 dígitos del código.')
