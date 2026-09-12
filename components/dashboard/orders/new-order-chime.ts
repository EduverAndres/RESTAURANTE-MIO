// Two short tones through the Web Audio API so no asset file is needed.
// Browsers block audio until the user interacts with the page; every
// failure is swallowed because the toast already carries the message.

type AudioContextCtor = typeof AudioContext

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  const candidate =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor })
      .webkitAudioContext
  return candidate ?? null
}

export function playNewOrderChime(): void {
  try {
    const Ctor = audioContextCtor()
    if (!Ctor) return
    const context = new Ctor()
    const start = context.currentTime
    for (const [offset, frequency] of [
      [0, 880],
      [0.18, 1175],
    ] as const) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, start + offset)
      gain.gain.exponentialRampToValueAtTime(0.2, start + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.16)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(start + offset)
      oscillator.stop(start + offset + 0.18)
    }
    setTimeout(() => void context.close().catch(() => undefined), 600)
  } catch {
    // Autoplay policy or unsupported API: stay silent.
  }
}
