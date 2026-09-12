'use client'

import { AccessibilityIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import {
  TEXT_SIZES,
  TEXT_SIZE_LABELS,
  accessibilityAnnouncement,
  type TextSize,
} from '@/lib/a11y/preferences'
import { cn } from '@/lib/utils'
import { usePreferencesStore } from '@/stores/preferences.store'

/**
 * The customer-facing accessibility menu: text size, high contrast, reduced
 * motion. Radix owns the roving focus, `Escape`, the typeahead and returning
 * focus to the trigger; what this adds is a single polite live region that
 * reads the resulting state back, so a screen reader user hears the effect of
 * the choice and not just the click.
 *
 * The values come from `localStorage` through zustand's `persist`, which only
 * hydrates on the client. Rendering the stored values straight away would
 * mismatch the server HTML, so the controls show the defaults until the store
 * has rehydrated — one frame, and only on the very first render.
 */
interface AccessibilityMenuProps {
  /**
   * `icon` is the round button in the site header; `nav` is the labelled
   * cell in the mobile bar, which matches the four links beside it.
   */
  variant?: 'icon' | 'nav'
  className?: string
}

export function AccessibilityMenu({
  variant = 'icon',
  className,
}: AccessibilityMenuProps) {
  const textSize = usePreferencesStore((state) => state.textSize)
  const highContrast = usePreferencesStore((state) => state.highContrast)
  const reduceMotion = usePreferencesStore((state) => state.reduceMotion)
  const setTextSize = usePreferencesStore((state) => state.setTextSize)
  const setHighContrast = usePreferencesStore((state) => state.setHighContrast)
  const setReduceMotion = usePreferencesStore((state) => state.setReduceMotion)

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const [announcement, setAnnouncement] = useState('')

  function announce(next: {
    textSize: TextSize
    highContrast: boolean
    reduceMotion: boolean
  }) {
    setAnnouncement(accessibilityAnnouncement(next))
  }

  const current = mounted
    ? { textSize, highContrast, reduceMotion }
    : { textSize: 'normal' as TextSize, highContrast: false, reduceMotion: false }

  return (
    <>
      {/*
        The board-level pattern: one region for the whole menu rather than a
        live announcement per control.
      */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {variant === 'nav' ? (
            <button
              type="button"
              className={cn(
                'text-muted-foreground hover:text-foreground flex w-full flex-col items-center gap-1 px-2 py-2.5 text-[11px] font-medium transition-colors',
                className,
              )}
            >
              <AccessibilityIcon aria-hidden="true" className="size-5" />
              Accesibilidad
            </button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Opciones de accesibilidad"
              title="Opciones de accesibilidad"
              className={cn('rounded-pill', className)}
            >
              <AccessibilityIcon aria-hidden="true" />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side={variant === 'nav' ? 'top' : 'bottom'}
          className="w-60"
        >
          <DropdownMenuLabel>Tamaño del texto</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={current.textSize}
            onValueChange={(value) => {
              const next = value as TextSize
              setTextSize(next)
              announce({ ...current, textSize: next })
            }}
          >
            {TEXT_SIZES.map((size) => (
              <DropdownMenuRadioItem key={size} value={size}>
                {TEXT_SIZE_LABELS[size]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />

          <DropdownMenuLabel>Visualización</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={current.highContrast}
            onCheckedChange={(checked) => {
              setHighContrast(checked === true)
              announce({ ...current, highContrast: checked === true })
            }}
          >
            Contraste alto
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={current.reduceMotion}
            onCheckedChange={(checked) => {
              setReduceMotion(checked === true)
              announce({ ...current, reduceMotion: checked === true })
            }}
          >
            Reducir animaciones
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
