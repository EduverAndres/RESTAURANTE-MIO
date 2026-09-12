import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

// The automated half of the accessibility policy (see docs/ACCESSIBILITY.md).
//
// It runs inside the existing journeys rather than in a separate "a11y suite",
// so a page is audited in the state a real visitor reaches it in — cart filled,
// dialog open, error showing — and a regression fails the same test that
// covers the feature.

/** WCAG 2.0/2.1 levels A and AA, which is the standard this app commits to. */
const WCAG_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const

/** The only severities that fail a build; see the doc for the reasoning. */
const BLOCKING_IMPACTS = new Set(['critical', 'serious'])

export interface AuditOptions {
  /** Restrict the scan with a CSS selector, e.g. to an open dialog. */
  include?: string
  /** Ignore a subtree, e.g. a third-party map canvas. */
  exclude?: string
  /**
   * Rules to switch off for this one call. Every entry needs a comment at the
   * call site saying why, and must be listed in docs/ACCESSIBILITY.md. Never
   * disable a rule globally.
   */
  disableRules?: string[]
}

function describe(violation: {
  id: string
  impact?: string | null
  help: string
  helpUrl: string
  nodes: { target: unknown[]; html?: string; failureSummary?: string }[]
}): string {
  const targets = violation.nodes
    .slice(0, 5)
    .map(
      (node) =>
        `      - ${JSON.stringify(node.target)}\n        ${(
          node.html ?? ''
        ).slice(0, 240)}\n        ${(node.failureSummary ?? '')
          .split('\n')
          .filter(Boolean)
          .slice(1)
          .join(' / ')}`,
    )
    .join('\n')
  return [
    `  [${violation.impact ?? 'unknown'}] ${violation.id}: ${violation.help}`,
    `    ${violation.helpUrl}`,
    targets,
    violation.nodes.length > 5
      ? `      … and ${violation.nodes.length - 5} more`
      : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Scans the current page and fails the test on any critical or serious
 * WCAG 2.1 AA violation.
 *
 * `label` is what shows up in the failure message, so name the screen and the
 * state: "storefront · cart open", not "page".
 */
export async function expectNoA11yViolations(
  page: Page,
  label: string,
  options: AuditOptions = {},
): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags([...WCAG_AA_TAGS])

  if (options.include) builder = builder.include(options.include)
  if (options.exclude) builder = builder.exclude(options.exclude)
  if (options.disableRules?.length) {
    builder = builder.disableRules(options.disableRules)
  }

  const { violations } = await builder.analyze()
  const blocking = violations.filter((violation) =>
    BLOCKING_IMPACTS.has(violation.impact ?? ''),
  )

  // Assert on the rule ids rather than the raw violation objects: axe's
  // result payload is thousands of lines, and a diff that size buries the one
  // sentence that says what broke.
  expect(
    blocking.map((violation) => violation.id),
    blocking.length === 0
      ? ''
      : `axe found ${blocking.length} blocking violation(s) on ${label}:\n${blocking
          .map(describe)
          .join('\n')}`,
  ).toEqual([])
}
