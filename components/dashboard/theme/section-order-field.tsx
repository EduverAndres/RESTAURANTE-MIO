'use client'

import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { THEME_SECTION_LABELS, moveSection } from '@/lib/validations/theme'
import type { ThemeSection } from '@/types/app'

interface SectionOrderFieldProps {
  value: ThemeSection[]
  onChange: (value: ThemeSection[]) => void
}

/** Up/down list for the storefront section order (no drag and drop). */
export function SectionOrderField({ value, onChange }: SectionOrderFieldProps) {
  return (
    <ol className="space-y-1" aria-label="Orden de las secciones">
      {value.map((section, index) => (
        <li
          key={section}
          className="rounded-control bg-muted/60 flex items-center justify-between gap-2 px-3 py-1.5 text-sm"
        >
          <span>
            <span className="text-muted-foreground mr-2 text-xs tabular-nums">
              {index + 1}.
            </span>
            {THEME_SECTION_LABELS[section]}
          </span>
          <span className="flex items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Subir ${THEME_SECTION_LABELS[section]}`}
              disabled={index === 0}
              onClick={() => onChange(moveSection(value, section, 'up'))}
            >
              <ChevronUpIcon aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Bajar ${THEME_SECTION_LABELS[section]}`}
              disabled={index === value.length - 1}
              onClick={() => onChange(moveSection(value, section, 'down'))}
            >
              <ChevronDownIcon aria-hidden="true" />
            </Button>
          </span>
        </li>
      ))}
    </ol>
  )
}
