'use client'

import { PauseIcon, PlayIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { reducedMotionQuery } from '@/lib/store/motion'

interface VideoBackdropProps {
  src: string
  /** Painted until the first frame is ready, and whenever motion is off. */
  poster: string | null
  /** `none` from the theme, or the visitor's own reduced-motion setting. */
  motionOff: boolean
}

/**
 * A muted, looping background video with a real pause control.
 *
 * Autoplay is a decision the visitor never made, so the control is a genuine
 * button — labelled, reachable by keyboard, and sitting above the video rather
 * than hidden in a corner overlay. When motion is off (theme or system) the
 * video never starts and the poster stands in for it.
 */
export function VideoBackdrop({ src, poster, motionOff }: VideoBackdropProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(!motionOff)
  const [reduced, setReduced] = useState(motionOff)

  useEffect(() => {
    const query = reducedMotionQuery()
    const apply = () => {
      const off = motionOff || (query?.matches ?? false)
      setReduced(off)
      setPlaying(!off)
    }
    apply()
    query?.addEventListener('change', apply)
    return () => query?.removeEventListener('change', apply)
  }, [motionOff])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (playing) {
      // A blocked autoplay is not an error worth surfacing; the poster stays.
      // `play()` predates promises, so the result is normalised before it is
      // awaited — some engines still return undefined.
      void Promise.resolve(video.play()).catch(() => setPlaying(false))
    } else {
      video.pause()
    }
  }, [playing])

  return (
    <>
      <video
        ref={videoRef}
        className="absolute inset-0 size-full object-cover"
        src={reduced ? undefined : src}
        poster={poster ?? undefined}
        muted
        loop
        playsInline
        preload={reduced ? 'none' : 'metadata'}
        aria-hidden="true"
        tabIndex={-1}
      />
      <button
        type="button"
        onClick={() => setPlaying((value) => !value)}
        aria-pressed={playing}
        className="absolute top-4 right-4 z-10 inline-flex size-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
      >
        {playing ? (
          <PauseIcon aria-hidden="true" className="size-5" />
        ) : (
          <PlayIcon aria-hidden="true" className="size-5" />
        )}
        <span className="sr-only">
          {playing
            ? 'Pausar el video de fondo'
            : 'Reproducir el video de fondo'}
        </span>
      </button>
    </>
  )
}
