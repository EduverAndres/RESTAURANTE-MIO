'use client'

import {
  ExternalLinkIcon,
  MonitorIcon,
  MoonIcon,
  RotateCwIcon,
  SmartphoneIcon,
  SunIcon,
  TabletIcon,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  PREVIEW_MESSAGE_TYPE,
  PREVIEW_READY_TYPE,
  encodePreviewTheme,
  previewCookieName,
} from '@/lib/theme/preview-message'
import { cn } from '@/lib/utils'
import type { StoreTheme } from '@/types/app'

/**
 * The live preview.
 *
 * It is the real storefront — the same route, the same server components, the
 * same data — running inside an iframe at `/t/<slug>/preview`, which only the
 * owner of the shop can open. The editor pushes the in-progress theme over
 * `postMessage` and drops it in a cookie for the server half; nothing here
 * saves anything.
 *
 * The frame is rendered at the real device width and scaled to fit, so a phone
 * preview is a phone layout rather than a narrow desktop one.
 */

const DEVICES = [
  { id: 'mobile', label: 'Móvil', width: 390, icon: SmartphoneIcon },
  { id: 'tablet', label: 'Tablet', width: 834, icon: TabletIcon },
  { id: 'desktop', label: 'Escritorio', width: 1280, icon: MonitorIcon },
] as const
type DeviceId = (typeof DEVICES)[number]['id']

const SCHEMES = [
  { id: 'light', label: 'Claro', icon: SunIcon },
  { id: 'dark', label: 'Oscuro', icon: MoonIcon },
] as const
type SchemeId = 'auto' | 'light' | 'dark'

/** Long enough to coalesce typing, short enough to still feel live. */
const PUSH_DEBOUNCE_MS = 120

/** The draft cookie is a scratch value; an hour is plenty. */
const COOKIE_MAX_AGE = 3600

function writePreviewCookie(storeId: string, theme: StoreTheme): void {
  const encoded = encodePreviewTheme(theme)
  if (!encoded) return
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${previewCookieName(storeId)}=${encoded}; path=/t; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`
}

export function PreviewPane({
  slug,
  storeId,
  theme,
  className,
}: {
  slug: string
  storeId: string
  theme: StoreTheme
  className?: string
}) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const readyRef = useRef(false)

  const [device, setDevice] = useState<DeviceId>('mobile')
  const [scheme, setScheme] = useState<SchemeId>('auto')
  const [stageWidth, setStageWidth] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)

  const deviceWidth = DEVICES.find((item) => item.id === device)!.width
  const scale = stageWidth > 0 ? Math.min(1, stageWidth / deviceWidth) : 1

  // Keep the frame scaled to whatever room the pane actually has.
  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const observer = new ResizeObserver(([entry]) => {
      setStageWidth(entry.contentRect.width)
    })
    observer.observe(stage)
    setStageWidth(stage.clientWidth)
    return () => observer.disconnect()
  }, [])

  // The frame announces itself once its bridge is listening.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return
      if ((event.data as { type?: string })?.type !== PREVIEW_READY_TYPE) return
      readyRef.current = true
      writePreviewCookie(storeId, theme)
      frameRef.current?.contentWindow?.postMessage(
        { type: PREVIEW_MESSAGE_TYPE, theme, scheme },
        window.location.origin,
      )
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [storeId, theme, scheme])

  // Push the draft, debounced, so typing a hex code does not flood the frame.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      writePreviewCookie(storeId, theme)
      if (!readyRef.current) return
      frameRef.current?.contentWindow?.postMessage(
        { type: PREVIEW_MESSAGE_TYPE, theme, scheme },
        window.location.origin,
      )
    }, PUSH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [storeId, theme, scheme])

  return (
    <div className={cn('flex min-h-0 flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="radiogroup"
          aria-label="Tamaño de pantalla"
          className="bg-muted flex items-center gap-0.5 rounded-full p-0.5"
        >
          {DEVICES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={device === item.id}
              aria-label={item.label}
              title={item.label}
              onClick={() => setDevice(item.id)}
              className={cn(
                'focus-visible:ring-ring/50 flex size-8 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-3',
                device === item.id
                  ? 'bg-background text-foreground shadow-1'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <item.icon aria-hidden className="size-4" />
            </button>
          ))}
        </div>

        <div
          role="radiogroup"
          aria-label="Claro u oscuro"
          className="bg-muted flex items-center gap-0.5 rounded-full p-0.5"
        >
          {SCHEMES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={scheme === item.id}
              aria-label={item.label}
              title={item.label}
              onClick={() =>
                setScheme((current) => (current === item.id ? 'auto' : item.id))
              }
              className={cn(
                'focus-visible:ring-ring/50 flex size-8 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-3',
                scheme === item.id
                  ? 'bg-background text-foreground shadow-1'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <item.icon aria-hidden className="size-4" />
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Recargar la vista previa"
            onClick={() => {
              readyRef.current = false
              setReloadKey((key) => key + 1)
            }}
          >
            <RotateCwIcon aria-hidden />
          </Button>
          <Button asChild variant="ghost" size="icon-sm">
            <a
              href={`/t/${slug}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Abrir la tienda publicada en otra pestaña"
            >
              <ExternalLinkIcon aria-hidden />
            </a>
          </Button>
        </div>
      </div>

      <div
        ref={stageRef}
        className="bg-muted/40 border-border min-h-0 flex-1 overflow-hidden rounded-[var(--radius-lg)] border p-3"
      >
        <div
          className="shadow-2 mx-auto overflow-hidden rounded-[var(--radius-md)] bg-white"
          style={{
            width: deviceWidth * scale,
            height: '100%',
          }}
        >
          <iframe
            key={reloadKey}
            ref={frameRef}
            title="Vista previa de tu tienda"
            src={`/t/${slug}/preview`}
            className="origin-top-left border-0"
            style={{
              width: deviceWidth,
              height: `${100 / scale}%`,
              transform: `scale(${scale})`,
            }}
          />
        </div>
      </div>
    </div>
  )
}
