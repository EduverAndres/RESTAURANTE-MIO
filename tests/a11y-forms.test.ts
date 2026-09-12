import { describe, expect, it } from 'vitest'
import { describedBy, errorId, hintId } from '@/lib/a11y/forms'

describe('describedBy', () => {
  it('is undefined when nothing describes the field', () => {
    expect(describedBy()).toBeUndefined()
    expect(describedBy(false, null, undefined, '')).toBeUndefined()
  })

  it('joins the ids that are actually rendered', () => {
    expect(describedBy('a-hint')).toBe('a-hint')
    expect(describedBy('a-hint', 'a-error')).toBe('a-hint a-error')
  })

  it('drops the ids whose element is not rendered', () => {
    // The usual call shape: `hasError && errorId(id)`.
    expect(describedBy('a-hint', false)).toBe('a-hint')
    expect(describedBy(false, 'a-error')).toBe('a-error')
  })

  it('does not repeat an id listed twice', () => {
    expect(describedBy('a-hint', 'a-hint')).toBe('a-hint')
  })
})

describe('errorId / hintId', () => {
  it('derive stable ids from the field id', () => {
    expect(errorId('login-email')).toBe('login-email-error')
    expect(hintId('login-email')).toBe('login-email-hint')
  })
})
