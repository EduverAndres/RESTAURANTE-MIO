'use client'

import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { playSoundEvent, unlockAudio } from '@/lib/sound/player'
import { useSoundPreferences } from '@/lib/sound/preferences'
import { cn } from '@/lib/utils'

interface SoundToggleProps {
  className?: string
  /** Header placement: label and switch only, no description line. */
  compact?: boolean
}

/**
 * Switch for the status-change tones. Turning it on plays the `accepted`
 * tone as a preview: that click is the gesture the browser needs to let
 * audio start, so the preview also unlocks the context.
 */
export function SoundToggle({ className, compact = false }: SoundToggleProps) {
  const enabled = useSoundPreferences((state) => state.enabled)
  const setEnabled = useSoundPreferences((state) => state.setEnabled)
  // The store rehydrates from localStorage after mount; until then render
  // the default so the first client paint matches the server markup.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  const checked = hydrated ? enabled : true

  const onCheckedChange = (next: boolean) => {
    // Unlock first: this click is the gesture the browser needs, and it must
    // count even if persisting the preference fails right after.
    if (next) unlockAudio()
    try {
      setEnabled(next)
    } catch {
      // zustand `persist` updates the in-memory state before it writes, so
      // when `localStorage.setItem` throws (Safari private mode, full quota)
      // the switch has already flipped for this session; only the write is
      // lost, and that is fine.
    }
    // After the flip: `playSoundEvent` is a no-op while the store says off.
    if (next) playSoundEvent('accepted')
  }

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Label
          htmlFor="sound-toggle"
          className="text-muted-foreground flex items-center gap-2 text-sm"
        >
          Sonido
          <span className="text-foreground font-medium">
            {checked ? 'Activado' : 'Desactivado'}
          </span>
        </Label>
        <Switch
          id="sound-toggle"
          checked={checked}
          onCheckedChange={onCheckedChange}
          aria-label="Sonido en los cambios de estado"
        />
      </div>
    )
  }

  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <div className="space-y-0.5">
        <Label htmlFor="sound-toggle" className="text-sm font-medium">
          Sonido en los cambios de estado
        </Label>
        <p className="text-muted-foreground text-xs">
          Un tono suave cuando un pedido cambia de estado.
        </p>
      </div>
      <Switch
        id="sound-toggle"
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label="Sonido en los cambios de estado"
      />
    </div>
  )
}
