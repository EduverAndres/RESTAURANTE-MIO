'use client'

import { CheckIcon, SparklesIcon, TriangleAlertIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { generatePalettes, type PaletteSuggestion } from '@/lib/theme/palette'
import type { ThemeMode } from '@/types/app'

/**
 * "Generar armonía": three complete palettes built around the merchant's
 * primary in OKLCH (see lib/theme/palette), each with the contrast it scores
 * and a plain verdict against WCAG AA. Nothing is applied until a card is
 * clicked, so the suggestions never surprise anyone.
 */

const SWATCH_KEYS = [
  'primary',
  'secondary',
  'accent',
  'background',
  'surface',
  'text',
] as const

function ContrastLine({ label, ratio }: { label: string; ratio: number }) {
  const ok = ratio >= 4.5
  return (
    <li className="flex items-center gap-1">
      {ok ? (
        <CheckIcon aria-hidden className="text-primary size-3" />
      ) : (
        <TriangleAlertIcon aria-hidden className="text-destructive size-3" />
      )}
      <span className={ok ? '' : 'text-destructive'}>
        {label} {ratio}:1
      </span>
    </li>
  )
}

function PaletteCard({
  palette,
  onApply,
}: {
  palette: PaletteSuggestion
  onApply: (palette: PaletteSuggestion) => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onApply(palette)}
        className="border-border hover:border-primary/60 focus-visible:ring-ring/50 bg-card flex w-full flex-col gap-2 rounded-[var(--radius-lg)] border p-3 text-left transition-colors outline-none focus-visible:ring-3"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{palette.label}</span>
          <span
            className={
              palette.passesAA
                ? 'text-primary text-xs font-medium'
                : 'text-destructive text-xs font-medium'
            }
          >
            {palette.passesAA ? '✓ AA' : '⚠ Revisa'}
          </span>
        </span>

        <span aria-hidden className="flex overflow-hidden rounded-full">
          {SWATCH_KEYS.map((key) => (
            <span
              key={key}
              className="h-6 flex-1"
              style={{ backgroundColor: palette.colors[key] }}
            />
          ))}
        </span>

        <span className="text-muted-foreground text-xs text-pretty">
          {palette.description}
        </span>

        <ul className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] tabular-nums">
          <ContrastLine
            label="Texto/fondo"
            ratio={palette.contrast.textOnBackground}
          />
          <ContrastLine
            label="Texto/tarjeta"
            ratio={palette.contrast.textOnSurface}
          />
          <ContrastLine
            label="Sobre el botón"
            ratio={palette.contrast.onPrimary}
          />
        </ul>
      </button>
    </li>
  )
}

export function PaletteSuggestions({
  primary,
  mode,
  onApply,
}: {
  primary: string
  mode: ThemeMode
  onApply: (palette: PaletteSuggestion) => void
}) {
  const [palettes, setPalettes] = useState<PaletteSuggestion[] | null>(null)

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="rounded-pill w-full"
        onClick={() => setPalettes(generatePalettes(primary, mode))}
      >
        <SparklesIcon aria-hidden />
        Generar armonía
      </Button>

      {palettes === null ? (
        <p className="text-muted-foreground text-xs">
          Te proponemos tres combinaciones a partir de tu color principal.
        </p>
      ) : (
        <ul aria-label="Paletas sugeridas" className="grid gap-2">
          {palettes.map((palette) => (
            <PaletteCard
              key={palette.kind}
              palette={palette}
              onApply={onApply}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
