'use client'

import { CheckIcon, TriangleAlertIcon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { FieldError } from '@/components/dashboard/store/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { contrastRatio } from '@/lib/color/contrast'
import { normalizeHex } from '@/lib/theme'
import { cn } from '@/lib/utils'

/**
 * A colour input that shows the consequence of the choice, not just the
 * choice: the native picker, an editable hex field, the colours the merchant
 * used recently, and the live contrast of this colour against the grounds it
 * will actually sit on.
 */

const SIX_DIGIT_HEX = /^#[0-9a-f]{6}$/i

/** WCAG AA for body copy. */
const AA_TEXT = 4.5

const RECENT_KEY = 'tienda:theme-recent-colors'
const RECENT_MAX = 10

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((value) => normalizeHex(value))
      .filter((value): value is string => value !== null)
      .slice(0, RECENT_MAX)
  } catch {
    return []
  }
}

/**
 * The merchant's recent colours, shared by every colour field on the page and
 * remembered between visits. Storage can be unavailable (private windows,
 * blocked site data), so every access is guarded and the editor still works.
 */
export function useRecentColors(): {
  recent: string[]
  remember: (value: string) => void
} {
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => {
    setRecent(readRecent())
  }, [])

  const remember = useCallback((value: string) => {
    const hex = normalizeHex(value)
    if (!hex) return
    setRecent((current) => {
      const next = [hex, ...current.filter((item) => item !== hex)].slice(
        0,
        RECENT_MAX,
      )
      try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
      } catch {
        // A remembered swatch is a convenience, never a requirement.
      }
      return next
    })
  }, [])

  return { recent, remember }
}

interface ContrastTarget {
  label: string
  color: string
}

interface ColorFieldProps {
  id: string
  label: string
  value: string
  error?: string
  hint?: string
  /** Grounds this colour will sit on (or inks that will sit on it). */
  against?: ContrastTarget[]
  recent?: string[]
  onChange: (value: string) => void
  /** Called when the merchant settles on a colour, to remember the swatch. */
  onCommit?: (value: string) => void
}

function ratioOf(a: string, b: string): number | null {
  try {
    return Math.round(contrastRatio(a, b) * 100) / 100
  } catch {
    return null
  }
}

export function ColorField({
  id,
  label,
  value,
  error,
  hint,
  against = [],
  recent = [],
  onChange,
  onCommit,
}: ColorFieldProps) {
  // The native picker only accepts a full hex; keep the last valid one.
  const swatch = SIX_DIGIT_HEX.test(value) ? value : '#000000'

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`Selector de ${label.toLowerCase()}`}
          value={swatch}
          onChange={(event) => onChange(event.target.value)}
          onBlur={(event) => onCommit?.(event.target.value)}
          className="rounded-control border-border size-10 shrink-0 cursor-pointer border bg-transparent p-1"
        />
        <Input
          id={id}
          value={value}
          spellCheck={false}
          maxLength={7}
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-error`}
          className="rounded-control h-10 font-mono text-sm uppercase"
          onChange={(event) => onChange(event.target.value)}
          onBlur={(event) => onCommit?.(event.target.value)}
        />
      </div>

      {recent.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1 pt-0.5">
          <span className="text-muted-foreground mr-1 text-xs">Recientes</span>
          {recent.map((color) => (
            <button
              key={color}
              type="button"
              title={color}
              aria-label={`Usar ${color}`}
              onClick={() => {
                onChange(color)
                onCommit?.(color)
              }}
              style={{ backgroundColor: color }}
              className="focus-visible:ring-ring/50 border-border size-5 rounded-full border outline-none focus-visible:ring-3"
            />
          ))}
        </div>
      ) : null}

      {against.length > 0 ? (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
          {against.map((target) => {
            const ratio = ratioOf(value, target.color)
            const ok = ratio !== null && ratio >= AA_TEXT
            return (
              <li
                key={target.label}
                className={cn(
                  'flex items-center gap-1 text-xs',
                  ok ? 'text-muted-foreground' : 'text-destructive',
                )}
              >
                {ok ? (
                  <CheckIcon aria-hidden className="size-3" />
                ) : (
                  <TriangleAlertIcon aria-hidden className="size-3" />
                )}
                <span>
                  {target.label} {ratio === null ? '—' : `${ratio}:1`}
                </span>
                <span className="sr-only">
                  {ok
                    ? 'cumple el mínimo AA'
                    : 'no cumple el mínimo AA de 4.5:1'}
                </span>
              </li>
            )
          })}
        </ul>
      ) : null}

      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  )
}
