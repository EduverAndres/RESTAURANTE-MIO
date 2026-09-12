import { describe, expect, it } from 'vitest'
import {
  KANBAN_SHORTCUT_HINT,
  isTypingTarget,
  shortcutAction,
} from '@/lib/a11y/kanban-shortcuts'
import { nextMerchantActions } from '@/lib/orders/status'

describe('shortcutAction', () => {
  it('maps A to "aceptar" for a pending order', () => {
    const actions = nextMerchantActions('pending', 'delivery')
    expect(shortcutAction('a', actions)?.to).toBe('accepted')
    expect(shortcutAction('A', actions)?.to).toBe('accepted')
  })

  it('maps L to "listo" for an order being prepared', () => {
    const actions = nextMerchantActions('preparing', 'delivery')
    expect(shortcutAction('l', actions)?.to).toBe('ready')
    expect(shortcutAction('L', actions)?.to).toBe('ready')
  })

  it('returns null when the transition is not legal right now', () => {
    // A prepared order can no longer be accepted.
    expect(
      shortcutAction('a', nextMerchantActions('preparing', 'pickup')),
    ).toBe(null)
    // A brand new order cannot jump straight to ready.
    expect(shortcutAction('l', nextMerchantActions('pending', 'pickup'))).toBe(
      null,
    )
  })

  it('returns null for a delivered order, which has no actions left', () => {
    const actions = nextMerchantActions('delivered', 'delivery')
    expect(shortcutAction('a', actions)).toBe(null)
    expect(shortcutAction('l', actions)).toBe(null)
  })

  it('ignores keys that are not shortcuts', () => {
    const actions = nextMerchantActions('pending', 'delivery')
    expect(shortcutAction('x', actions)).toBe(null)
    expect(shortcutAction('Enter', actions)).toBe(null)
    expect(shortcutAction(' ', actions)).toBe(null)
    expect(shortcutAction('', actions)).toBe(null)
  })

  it('never resolves to a destructive transition', () => {
    const actions = nextMerchantActions('pending', 'delivery')
    expect(actions.some((action) => action.to === 'cancelled')).toBe(true)
    expect(shortcutAction('a', actions)?.to).not.toBe('cancelled')
    expect(shortcutAction('l', actions)).toBe(null)
  })

  it('exposes a Spanish hint naming both keys', () => {
    expect(KANBAN_SHORTCUT_HINT).toContain('A')
    expect(KANBAN_SHORTCUT_HINT).toContain('L')
  })
})

describe('isTypingTarget', () => {
  function element(html: string): Element {
    const host = document.createElement('div')
    host.innerHTML = html
    return host.firstElementChild as Element
  }

  it('is true for text entry controls', () => {
    expect(isTypingTarget(element('<input />'))).toBe(true)
    expect(isTypingTarget(element('<textarea></textarea>'))).toBe(true)
    expect(isTypingTarget(element('<select></select>'))).toBe(true)
  })

  it('is true inside a contenteditable region', () => {
    const host = element('<div contenteditable="true"><span>hi</span></div>')
    document.body.append(host)
    expect(isTypingTarget(host.querySelector('span'))).toBe(true)
    host.remove()
  })

  it('is true for an element with an explicit textbox role', () => {
    expect(isTypingTarget(element('<div role="textbox"></div>'))).toBe(true)
  })

  it('is false for a card, a button and a null target', () => {
    expect(isTypingTarget(element('<article></article>'))).toBe(false)
    expect(isTypingTarget(element('<button>Aceptar</button>'))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })

  it('is false for a checkbox, which does not swallow letter keys', () => {
    expect(isTypingTarget(element('<input type="checkbox" />'))).toBe(false)
  })
})
