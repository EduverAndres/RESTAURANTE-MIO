// Browser side of the status tones: one shared `AudioContext`, unlocked on
// the first user gesture, that `playSoundEvent` schedules onto.
//
// Every failure is swallowed. The toast already carries the message; the tone
// is a courtesy, and the autoplay policy or a missing API must never surface
// as an error to the person using the app.
import { useSoundPreferences } from '@/lib/sound/preferences'
import {
  scheduleTones,
  toneSequenceFor,
  type SoundEvent,
} from '@/lib/sound/tones'

type AudioContextCtor = typeof AudioContext

let shared: AudioContext | null = null

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  const candidate =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor })
      .webkitAudioContext
  return candidate ?? null
}

function sharedContext(): AudioContext | null {
  if (shared) return shared
  const Ctor = audioContextCtor()
  if (!Ctor) return null
  shared = new Ctor()
  return shared
}

function resumeIfSuspended(context: AudioContext): void {
  if (context.state === 'suspended') {
    void context.resume().catch(() => undefined)
  }
}

/**
 * Creates and resumes the shared context. Meant for the first `pointerdown`
 * or `keydown` on the page: browsers only let audio start after a gesture,
 * and a context resumed once stays usable for later, gesture-less events.
 */
export function unlockAudio(): void {
  try {
    const context = sharedContext()
    if (context) resumeIfSuspended(context)
  } catch {
    // Unsupported or blocked: stay silent.
  }
}

/** Plays the tone sequence for `event`, if the device supports and allows it. */
export function playSoundEvent(event: SoundEvent): void {
  try {
    if (!useSoundPreferences.getState().enabled) return
    const steps = toneSequenceFor(event)
    if (steps.length === 0) return
    const context = sharedContext()
    if (!context) return
    resumeIfSuspended(context)
    scheduleTones(context, steps, context.currentTime)
  } catch {
    // Autoplay policy or unsupported API: stay silent.
  }
}
