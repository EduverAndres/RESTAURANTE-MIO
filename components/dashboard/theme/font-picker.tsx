'use client'

import { fontFamilyStack } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { THEME_FONTS, type ThemeFont } from '@/types/app'

/**
 * Font pickers that show the typeface instead of naming it, plus the pairings
 * that are known to work together. A pair is one click: titles and body copy
 * change at the same time, which is the decision a merchant is actually making.
 */

/** Curated title + body pairs, in the order they read best. */
export const FONT_PAIRS: readonly {
  display: ThemeFont
  body: ThemeFont
  label: string
  mood: string
}[] = [
  {
    display: 'Fraunces',
    body: 'Inter',
    label: 'Fraunces + Inter',
    mood: 'Cálida y cercana',
  },
  {
    display: 'Playfair Display',
    body: 'DM Sans',
    label: 'Playfair + DM Sans',
    mood: 'Clásica de mantel largo',
  },
  {
    display: 'Space Grotesk',
    body: 'Inter',
    label: 'Space Grotesk + Inter',
    mood: 'Moderna y directa',
  },
  {
    display: 'Instrument Serif',
    body: 'Geist',
    label: 'Instrument Serif + Geist',
    mood: 'Editorial y sobria',
  },
]

function FontOptions({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: ThemeFont
  onChange: (font: ThemeFont) => void
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-1.5 text-sm leading-none font-medium">
        {label}
      </legend>
      <div className="grid grid-cols-2 gap-1.5">
        {THEME_FONTS.map((font) => (
          <label
            key={font}
            className="has-focus-visible:ring-ring/50 border-border hover:bg-muted/60 has-checked:border-primary has-checked:bg-primary/10 flex min-h-11 cursor-pointer items-center justify-center rounded-[var(--radius-md)] border px-2 py-1.5 text-center transition-colors has-focus-visible:ring-3"
          >
            <input
              type="radio"
              name={id}
              className="sr-only"
              checked={value === font}
              onChange={() => onChange(font)}
            />
            <span
              className="truncate text-base"
              style={{ fontFamily: fontFamilyStack(font) }}
            >
              {font}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function FontPicker({
  display,
  body,
  onChange,
}: {
  display: ThemeFont
  body: ThemeFont
  onChange: (next: { fontDisplay: ThemeFont; fontBody: ThemeFont }) => void
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <p className="text-sm leading-none font-medium">
          Combinaciones recomendadas
        </p>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {FONT_PAIRS.map((pair) => {
            const active = pair.display === display && pair.body === body
            return (
              <li key={pair.label}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    onChange({ fontDisplay: pair.display, fontBody: pair.body })
                  }
                  className={cn(
                    'focus-visible:ring-ring/50 w-full rounded-[var(--radius-md)] border px-3 py-2 text-left transition-colors outline-none focus-visible:ring-3',
                    active
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-muted/60',
                  )}
                >
                  <span
                    className="block truncate text-lg leading-tight"
                    style={{ fontFamily: fontFamilyStack(pair.display) }}
                  >
                    {pair.label}
                  </span>
                  <span
                    className="text-muted-foreground block truncate text-xs"
                    style={{ fontFamily: fontFamilyStack(pair.body) }}
                  >
                    {pair.mood}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <FontOptions
        id="theme-font-display"
        label="Tipografía de los títulos"
        value={display}
        onChange={(fontDisplay) => onChange({ fontDisplay, fontBody: body })}
      />
      <FontOptions
        id="theme-font-body"
        label="Tipografía del texto"
        value={body}
        onChange={(fontBody) => onChange({ fontDisplay: display, fontBody })}
      />
      <p className="text-muted-foreground text-xs">
        Fraunces e Inter se cargan con la página; las demás usan la versión que
        tenga el dispositivo de tu cliente.
      </p>
    </div>
  )
}
