'use client'

import { ChevronDownIcon, ChevronUpIcon, GripVerticalIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { THEME_SECTION_LABELS, moveSection } from '@/lib/validations/theme'
import { cn } from '@/lib/utils'
import {
  THEME_CORE_SECTIONS,
  THEME_SECTIONS,
  type ThemeSection,
} from '@/types/app'

/**
 * The order of the storefront bands, with two independent ways to change it:
 * drag and drop for a mouse, and subir / bajar buttons for a keyboard or a
 * screen reader. The buttons are not a fallback — they are always there, and
 * the list is perfectly usable without ever starting a drag.
 *
 * Drag and drop uses the platform's own HTML5 API rather than a library: one
 * sortable list of at most seven rows is not worth a dependency.
 */

const CORE: readonly ThemeSection[] = THEME_CORE_SECTIONS

/** Why a section cannot be switched off, in the merchant's words. */
const ALWAYS_ON_HINT = 'Esta sección siempre se muestra.'

const SECTION_HINTS: Partial<Record<ThemeSection, string>> = {
  featured: 'Se muestra solo si eliges productos destacados.',
  story: 'Se muestra solo si escribes el texto de tu historia.',
  social: 'Se muestra solo si agregas al menos una red.',
  reviews: 'Siempre activa; aparece apenas tu tienda tenga reseñas.',
}

function move<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length) return [...list]
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(Math.min(to, next.length), 0, item)
  return next
}

interface SectionOrderFieldProps {
  value: ThemeSection[]
  onChange: (value: ThemeSection[]) => void
}

export function SectionOrderField({ value, onChange }: SectionOrderFieldProps) {
  const hintId = useId()
  const [dragging, setDragging] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)

  const hidden = THEME_SECTIONS.filter((section) => !value.includes(section))

  function toggle(section: ThemeSection, on: boolean) {
    onChange(
      on ? [...value, section] : value.filter((item) => item !== section),
    )
  }

  return (
    <div className="space-y-3">
      <p id={hintId} className="text-muted-foreground text-xs">
        Arrastra para reordenar, o usa los botones de subir y bajar.
      </p>

      <ol
        aria-label="Orden de las secciones"
        aria-describedby={hintId}
        className="space-y-1"
      >
        {value.map((section, index) => (
          <li
            key={section}
            draggable
            onDragStart={(event) => {
              setDragging(index)
              event.dataTransfer.effectAllowed = 'move'
              // Firefox needs a payload before it will start a drag.
              event.dataTransfer.setData('text/plain', section)
            }}
            onDragEnd={() => {
              setDragging(null)
              setOver(null)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
              setOver(index)
            }}
            onDrop={(event) => {
              event.preventDefault()
              if (dragging !== null) onChange(move(value, dragging, index))
              setDragging(null)
              setOver(null)
            }}
            className={cn(
              'bg-muted/50 border-border flex items-center gap-2 rounded-[var(--radius-md)] border px-2 py-1.5 text-sm',
              dragging === index && 'opacity-50',
              over === index && dragging !== null && 'border-primary',
            )}
          >
            <GripVerticalIcon
              aria-hidden
              className="text-muted-foreground size-4 shrink-0 cursor-grab"
            />
            <span className="text-muted-foreground w-4 shrink-0 text-xs tabular-nums">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">
                {THEME_SECTION_LABELS[section]}
              </span>
              {SECTION_HINTS[section] ? (
                <span className="text-muted-foreground block truncate text-xs">
                  {SECTION_HINTS[section]}
                </span>
              ) : null}
            </span>

            <span className="flex shrink-0 items-center">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Subir ${THEME_SECTION_LABELS[section]}`}
                disabled={index === 0}
                onClick={() => onChange(moveSection(value, section, 'up'))}
              >
                <ChevronUpIcon aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Bajar ${THEME_SECTION_LABELS[section]}`}
                disabled={index === value.length - 1}
                onClick={() => onChange(moveSection(value, section, 'down'))}
              >
                <ChevronDownIcon aria-hidden />
              </Button>
              <Switch
                checked
                disabled={CORE.includes(section)}
                aria-label={`Mostrar ${THEME_SECTION_LABELS[section]}`}
                title={CORE.includes(section) ? ALWAYS_ON_HINT : undefined}
                className="ml-1"
                onCheckedChange={() => toggle(section, false)}
              />
            </span>
          </li>
        ))}
      </ol>

      {hidden.length > 0 ? (
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium">
            Secciones apagadas
          </p>
          <ul className="space-y-1">
            {hidden.map((section) => (
              <li
                key={section}
                className="border-border flex items-center gap-2 rounded-[var(--radius-md)] border border-dashed px-2 py-1.5 text-sm"
              >
                <span className="text-muted-foreground min-w-0 flex-1">
                  <span className="block truncate">
                    {THEME_SECTION_LABELS[section]}
                  </span>
                  {SECTION_HINTS[section] ? (
                    <span className="block truncate text-xs">
                      {SECTION_HINTS[section]}
                    </span>
                  ) : null}
                </span>
                <Switch
                  checked={false}
                  aria-label={`Mostrar ${THEME_SECTION_LABELS[section]}`}
                  onCheckedChange={() => toggle(section, true)}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
