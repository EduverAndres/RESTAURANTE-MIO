'use client'

import { CheckIcon } from 'lucide-react'
import { fontFamilyStack } from '@/lib/theme'
import { THEME_PRESETS, type ThemePreset } from '@/lib/theme/presets'
import { cn } from '@/lib/utils'
import type { StoreTheme } from '@/types/app'

/**
 * The eight starting looks.
 *
 * Every thumbnail is drawn from the preset's own colours, fonts, radius and
 * card style — there is no image asset anywhere — so a new preset is one entry
 * in lib/theme/presets and nothing else.
 */

const BUTTON_RADIUS: Record<StoreTheme['buttonStyle'], string> = {
  pill: '999px',
  rounded: '10px',
  square: '3px',
}

function PresetThumbnail({ theme }: { theme: StoreTheme }) {
  const surfaceShadow =
    theme.cardStyle === 'elevated' || theme.cardStyle === 'glass'
      ? '0 2px 8px rgb(0 0 0 / 0.14)'
      : 'none'
  const surfaceBorder =
    theme.cardStyle === 'outlined' || theme.cardStyle === 'glass'
      ? `1px solid ${theme.text}22`
      : '1px solid transparent'

  return (
    <span
      aria-hidden
      className="block h-24 w-full overflow-hidden rounded-[var(--radius-md)] p-2.5"
      style={{ backgroundColor: theme.background }}
    >
      {/* Hero band: the brand colour, or the gradient when it is on. */}
      <span
        className="mb-2 flex h-8 items-center px-2"
        style={{
          background: theme.gradient.enabled
            ? `linear-gradient(${theme.gradient.angle}deg, ${theme.gradient.from}, ${theme.gradient.to})`
            : theme.primary,
          borderRadius: `${Math.min(theme.radius, 14)}px`,
        }}
      >
        <span
          className="truncate text-[11px] leading-none"
          style={{
            color: theme.onPrimary,
            fontFamily: fontFamilyStack(theme.fontDisplay),
            fontWeight: theme.headingWeight,
            textTransform:
              theme.headingCase === 'uppercase' ? 'uppercase' : 'none',
          }}
        >
          Tu tienda
        </span>
      </span>

      {/* Two product cards and a button, the way the storefront stacks them. */}
      <span className="flex items-stretch gap-1.5">
        {[0, 1].map((index) => (
          <span
            key={index}
            className="flex h-9 flex-1 flex-col justify-center gap-1 px-1.5"
            style={{
              backgroundColor: theme.surface,
              borderRadius: `${Math.min(theme.radius, 14)}px`,
              boxShadow: surfaceShadow,
              border: surfaceBorder,
            }}
          >
            <span
              className="block h-1.5 rounded-full"
              style={{ backgroundColor: `${theme.text}40`, width: '70%' }}
            />
            <span
              className="block h-1.5 rounded-full"
              style={{ backgroundColor: theme.accent, width: '40%' }}
            />
          </span>
        ))}
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center"
          style={{
            backgroundColor: theme.primary,
            borderRadius: BUTTON_RADIUS[theme.buttonStyle],
          }}
        >
          <span
            className="block h-1.5 w-4 rounded-full"
            style={{ backgroundColor: theme.onPrimary }}
          />
        </span>
      </span>
    </span>
  )
}

export function PresetGallery({
  activeId,
  onApply,
}: {
  activeId: string | null
  onApply: (preset: ThemePreset) => void
}) {
  return (
    <ul aria-label="Estilos predefinidos" className="grid gap-2 sm:grid-cols-2">
      {THEME_PRESETS.map((preset) => {
        const active = preset.id === activeId
        return (
          <li key={preset.id}>
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onApply(preset)}
              className={cn(
                'focus-visible:ring-ring/50 group w-full rounded-[var(--radius-lg)] border p-2 text-left transition-colors outline-none focus-visible:ring-3',
                active
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50',
              )}
            >
              <PresetThumbnail theme={preset.theme} />
              <span className="mt-2 flex items-center gap-1.5 px-1">
                <span className="text-sm font-medium">{preset.name}</span>
                {active ? (
                  <CheckIcon aria-hidden className="text-primary size-3.5" />
                ) : null}
              </span>
              <span className="text-muted-foreground mt-0.5 block px-1 pb-1 text-xs text-pretty">
                {preset.description}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
