'use client'

import {
  CheckCircle2Icon,
  CircleAlertIcon,
  TriangleAlertIcon,
  WandSparklesIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  applyAccessibilityFix,
  applyAllAccessibilityFixes,
  auditTheme,
  type AccessibilityCheck,
} from '@/lib/theme/score'
import { cn } from '@/lib/utils'
import type { StoreTheme } from '@/types/app'

/**
 * The accessibility panel.
 *
 * It reports what a customer with low vision or big fingers will run into,
 * scores it out of 100 and offers to fix each problem in one click. The
 * contrast maths comes from Phase 2 (`contrastRatio`), not from here.
 *
 * The score lives in a polite live region so a screen reader announces the new
 * number after a fix without interrupting whatever the merchant is typing.
 */

const ICONS = {
  pass: CheckCircle2Icon,
  warn: TriangleAlertIcon,
  fail: CircleAlertIcon,
} as const

const TONE = {
  pass: 'text-primary',
  warn: 'text-amber-600 dark:text-amber-400',
  fail: 'text-destructive',
} as const

function verdict(score: number): string {
  if (score >= 95) return 'Tu tienda se ve bien para todo el mundo.'
  if (score >= 70) return 'Casi listo: quedan un par de detalles por ajustar.'
  return 'Hay cosas que a tus clientes les costará leer.'
}

function CheckRow({
  check,
  onFix,
}: {
  check: AccessibilityCheck
  onFix: (check: AccessibilityCheck) => void
}) {
  const Icon = ICONS[check.status]
  return (
    <li className="flex items-start gap-2.5 py-2">
      <Icon
        aria-hidden
        className={cn('mt-0.5 size-4 shrink-0', TONE[check.status])}
      />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium">
          {check.label}
          <span className="sr-only">
            {check.status === 'pass'
              ? ': correcto'
              : check.status === 'warn'
                ? ': con advertencia'
                : ': con error'}
          </span>
        </p>
        <p className="text-muted-foreground text-xs text-pretty">
          {check.detail}
        </p>
      </div>
      {check.fixable ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-pill shrink-0"
          onClick={() => onFix(check)}
        >
          Arreglar
        </Button>
      ) : null}
    </li>
  )
}

export function AccessibilityPanel({
  theme,
  onChange,
}: {
  theme: StoreTheme
  onChange: (theme: StoreTheme) => void
}) {
  const report = auditTheme(theme)
  const pending = report.checks.filter((check) => check.fixable)

  return (
    <section aria-labelledby="theme-a11y-title" className="space-y-3">
      <div className="flex items-center gap-3">
        <p
          aria-hidden
          className={cn(
            'text-2xl leading-none font-semibold tabular-nums',
            report.score >= 95
              ? 'text-primary'
              : report.score >= 70
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-destructive',
          )}
        >
          {report.score}
        </p>
        <div className="min-w-0 flex-1">
          <h3 id="theme-a11y-title" className="text-sm font-medium">
            Accesibilidad
          </h3>
          <p
            aria-live="polite"
            className="text-muted-foreground text-xs text-pretty"
          >
            {`Puntaje ${report.score} de 100. ${verdict(report.score)}`}
          </p>
        </div>
      </div>

      <div
        aria-hidden
        className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-[--duration-base] ease-[--ease-out-soft]',
            report.score >= 95
              ? 'bg-primary'
              : report.score >= 70
                ? 'bg-amber-500'
                : 'bg-destructive',
          )}
          style={{ width: `${report.score}%` }}
        />
      </div>

      <ul className="divide-border divide-y">
        {report.checks.map((check) => (
          <CheckRow
            key={check.id}
            check={check}
            onFix={(item) => onChange(applyAccessibilityFix(theme, item.id))}
          />
        ))}
      </ul>

      {pending.length > 1 ? (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="rounded-pill w-full"
          onClick={() => onChange(applyAllAccessibilityFixes(theme))}
        >
          <WandSparklesIcon aria-hidden />
          Arreglar todo ({pending.length})
        </Button>
      ) : null}
    </section>
  )
}
