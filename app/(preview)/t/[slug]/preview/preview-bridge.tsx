'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { normalizeTheme, themeToCssVars } from '@/lib/theme'
import {
  PREVIEW_READY_TYPE,
  isPreviewMessage,
  structureSignature,
  type PreviewMessage,
} from '@/lib/theme/preview-message'

/**
 * Applies the editor's in-progress theme to this page.
 *
 * Skin (every `--store-*` variable, the motion and scheme attributes and the
 * merchant stylesheet) is written straight onto the storefront wrapper, so a
 * colour or a font moves the preview on the next frame with no request at all.
 *
 * Structure — which sections exist, the menu layout, the hero variant, the
 * copy — is decided by server components, so when `structureSignature` moves
 * the bridge asks Next.js to re-render the tree. That is a soft refresh: the
 * iframe is not reloaded and the visitor's scroll position survives.
 *
 * Nothing is applied until the page has finished loading. The storefront
 * streams its sections in, and writing to the wrapper while React is still
 * hydrating a boundary below it produces a mismatch. Waiting costs nothing:
 * the server already rendered the draft that is in the cookie, so the first
 * message from the editor has nothing new to say.
 */

/** Id of the style element this component owns. */
const STYLE_ID = 'store-preview-custom-css'

interface PreviewBridgeProps {
  /** Structure signature of the theme the server just rendered. */
  signature: string
}

export function PreviewBridge({ signature }: PreviewBridgeProps) {
  const router = useRouter()
  const renderedRef = useRef(signature)
  const requestedRef = useRef<string | null>(null)
  const pendingRef = useRef<PreviewMessage | null>(null)
  const lastRef = useRef<PreviewMessage | null>(null)
  const applyRef = useRef<(message: PreviewMessage) => void>(() => {})
  const [armed, setArmed] = useState(false)

  // A server render has landed: whatever we asked for is now on screen.
  //
  // React has just re-rendered the wrapper from the server's own props, which
  // resets `data-store-scheme` to `theme.mode` and drops the device override
  // the toolbar had set. Re-applying the last message puts it back.
  //
  // Deliberately runs after *every* render rather than only when `signature`
  // changes: a refresh triggered by something other than the theme (the shop
  // opening, say) re-renders the wrapper just the same. `apply` is idempotent
  // and returns early once the structure matches, so this costs nothing.
  useEffect(() => {
    renderedRef.current = signature
    if (requestedRef.current === signature) requestedRef.current = null
    const last = lastRef.current
    if (last) applyRef.current(last)
  })

  // Hydration is done once the document has loaded; give it one more frame.
  useEffect(() => {
    let frame = 0
    const arm = () => {
      frame = window.requestAnimationFrame(() => setArmed(true))
    }
    if (document.readyState === 'complete') arm()
    else window.addEventListener('load', arm, { once: true })
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('load', arm)
    }
  }, [])

  useEffect(() => {
    function applyCustomCss(css: string | null) {
      const existing = document.getElementById(STYLE_ID)
      if (!css) {
        existing?.remove()
        return
      }
      const style =
        existing ??
        Object.assign(document.createElement('style'), { id: STYLE_ID })
      style.textContent = css
      if (!existing) document.body.append(style)
    }

    function apply(message: PreviewMessage) {
      const root = document.querySelector<HTMLElement>('[data-store-theme]')
      if (!root) return
      lastRef.current = message
      const theme = normalizeTheme(message.theme)

      for (const [name, value] of Object.entries(themeToCssVars(theme))) {
        root.style.setProperty(name, value)
      }
      root.dataset.storeMotion = theme.motion
      root.dataset.storeScheme =
        !message.scheme || message.scheme === 'auto'
          ? theme.mode === 'auto'
            ? 'auto'
            : theme.mode
          : message.scheme
      // Already sanitised and scoped to [data-store-theme] by normalizeTheme.
      applyCustomCss(theme.customCss)

      const incoming = structureSignature(theme)
      if (incoming === renderedRef.current) return
      if (incoming === requestedRef.current) return
      requestedRef.current = incoming
      router.refresh()
    }

    function onMessage(event: MessageEvent) {
      // Same-origin only: the editor and the preview are the same app.
      if (event.origin !== window.location.origin) return
      if (!isPreviewMessage(event.data)) return
      if (!armed) {
        pendingRef.current = event.data
        return
      }
      apply(event.data)
    }

    applyRef.current = apply
    window.addEventListener('message', onMessage)

    if (armed) {
      const pending = pendingRef.current
      pendingRef.current = null
      if (pending) apply(pending)
      // Only now does the editor get told to start pushing.
      window.parent?.postMessage(
        { type: PREVIEW_READY_TYPE },
        window.location.origin,
      )
    }

    return () => window.removeEventListener('message', onMessage)
  }, [router, armed])

  return null
}
