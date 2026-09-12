'use client'

import { ImageUpIcon, LoaderCircleIcon, Trash2Icon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  canvasToFile,
  cropToCanvas,
  extractColorsFromImage,
  loadImage,
  type CropGeometry,
} from './image-canvas'
import { uploadStoreAsset } from '@/app/dashboard/store/actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { validateImageFile } from '@/lib/uploads/image'
import { cn } from '@/lib/utils'

/**
 * Image upload with a crop step.
 *
 * The merchant never has to think about pixel sizes: the crop box is already
 * the aspect ratio the chosen layout will render, they move and zoom the photo
 * inside it, and what they framed is exactly what gets uploaded. The crop is
 * done on a canvas in the browser, so the file that reaches storage is already
 * the right shape and no bigger than it needs to be.
 *
 * Uploading reuses the existing `uploadStoreAsset` server action — the same
 * path, bucket, size limit and ownership check the Tienda screen uses.
 */

/** Width of the crop box on screen; the height follows the aspect ratio. */
const BOX_WIDTH = 320

const ZOOM_MIN = 1
const ZOOM_MAX = 3

interface Draft {
  url: string
  image: HTMLImageElement
  type: string
}

interface ImageFieldProps {
  label: string
  hint?: string
  storeId: string
  kind: 'logo' | 'cover'
  value: string | null
  /** Width / height of the crop box, from the layout the merchant picked. */
  aspect: number
  /** Rendering shape of the preview, purely cosmetic. */
  round?: boolean
  onChange: (url: string | null) => void
  /** Dominant colours of the freshly cropped image, when it is readable. */
  onColors?: (colors: string[]) => void
}

export function ImageField({
  label,
  hint,
  storeId,
  kind,
  value,
  aspect,
  round,
  onChange,
  onColors,
}: ImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ x: number; y: number } | null>(null)

  const [draft, setDraft] = useState<Draft | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)

  const boxHeight = Math.round(BOX_WIDTH / aspect)

  // Release the object URL as soon as the dialog is done with it.
  useEffect(() => {
    if (!draft) return
    return () => URL.revokeObjectURL(draft.url)
  }, [draft])

  const geometry = useCallback(
    (
      image: HTMLImageElement,
      currentZoom: number,
      current: { x: number; y: number },
    ): CropGeometry => {
      const natural = { w: image.naturalWidth, h: image.naturalHeight }
      const cover = Math.max(BOX_WIDTH / natural.w, boxHeight / natural.h)
      const scale = cover * currentZoom
      const drawWidth = natural.w * scale
      const drawHeight = natural.h * scale
      return {
        offsetX: Math.min(0, Math.max(BOX_WIDTH - drawWidth, current.x)),
        offsetY: Math.min(0, Math.max(boxHeight - drawHeight, current.y)),
        drawWidth,
        drawHeight,
        boxWidth: BOX_WIDTH,
        boxHeight,
      }
    },
    [boxHeight],
  )

  async function onPick(file: File) {
    const check = validateImageFile(file)
    if (!check.ok) {
      toast.error(check.error)
      return
    }
    const url = URL.createObjectURL(file)
    try {
      const image = await loadImage(url)
      setDraft({ url, image, type: file.type })
      setZoom(1)
      setOffset({ x: 0, y: 0 })
    } catch {
      URL.revokeObjectURL(url)
      toast.error('No pudimos abrir esa imagen.')
    }
  }

  async function onConfirm() {
    if (!draft) return
    setBusy(true)
    try {
      const canvas = cropToCanvas(
        draft.image,
        geometry(draft.image, zoom, offset),
      )
      if (onColors) {
        const extracted = extractColorsFromImage(draft.image)
        if (extracted.ok) onColors(extracted.colors)
        else toast.message(extracted.error)
      }

      const file = await canvasToFile(canvas, `${kind}.jpg`, draft.type)
      const body = new FormData()
      body.set('storeId', storeId)
      body.set('kind', kind)
      body.set('file', file)

      const result = await uploadStoreAsset(body)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      onChange(result.url)
      setDraft(null)
      toast.success('Imagen actualizada.')
    } catch {
      toast.error('No pudimos subir la imagen. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  const live = draft ? geometry(draft.image, zoom, offset) : null

  return (
    <div className="space-y-2">
      <p className="text-sm leading-none font-medium">{label}</p>

      <div className="flex items-center gap-3">
        <div
          className={cn(
            'bg-muted border-border relative shrink-0 overflow-hidden border',
            round
              ? 'size-16 rounded-full'
              : 'h-16 w-28 rounded-[var(--radius-md)]',
          )}
        >
          {value ? (
            // A merchant asset on Supabase storage; next/image would need the
            // host allow-listed in next.config, which is out of this scope.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt=""
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="text-muted-foreground flex size-full items-center justify-center">
              <ImageUpIcon aria-hidden className="size-5" />
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="rounded-pill"
            onClick={() => inputRef.current?.click()}
          >
            <ImageUpIcon aria-hidden />
            {value ? 'Cambiar' : 'Subir'}
          </Button>
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="rounded-pill"
              onClick={() => onChange(null)}
            >
              <Trash2Icon aria-hidden />
              Quitar
            </Button>
          ) : null}
        </div>
      </div>

      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        aria-label={`Seleccionar ${label.toLowerCase()}`}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void onPick(file)
        }}
      />

      <Dialog
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setDraft(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajusta la imagen</DialogTitle>
            <DialogDescription>
              Arrastra para mover y usa el control para acercar. Lo que queda
              dentro del marco es lo que verán tus clientes.
            </DialogDescription>
          </DialogHeader>

          {draft && live ? (
            <div className="space-y-3">
              <div
                ref={boxRef}
                role="application"
                aria-label="Marco de recorte"
                style={{ width: BOX_WIDTH, height: boxHeight }}
                className="bg-muted relative mx-auto cursor-grab overflow-hidden rounded-[var(--radius-md)] select-none active:cursor-grabbing"
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId)
                  dragRef.current = {
                    x: event.clientX - live.offsetX,
                    y: event.clientY - live.offsetY,
                  }
                }}
                onPointerMove={(event) => {
                  const start = dragRef.current
                  if (!start) return
                  setOffset({
                    x: event.clientX - start.x,
                    y: event.clientY - start.y,
                  })
                }}
                onPointerUp={() => {
                  dragRef.current = null
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={draft.url}
                  alt=""
                  draggable={false}
                  style={{
                    width: live.drawWidth,
                    height: live.drawHeight,
                    transform: `translate(${live.offsetX}px, ${live.offsetY}px)`,
                  }}
                  className="max-w-none origin-top-left"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="theme-crop-zoom"
                  className="text-sm leading-none font-medium"
                >
                  Acercar
                </label>
                <input
                  id="theme-crop-zoom"
                  type="range"
                  min={ZOOM_MIN}
                  max={ZOOM_MAX}
                  step={0.01}
                  value={zoom}
                  className="accent-primary focus-visible:ring-ring/50 h-9 w-full rounded-full outline-none focus-visible:ring-3"
                  onChange={(event) => setZoom(Number(event.target.value))}
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="rounded-pill"
              disabled={busy}
              onClick={() => setDraft(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="rounded-pill"
              disabled={busy}
              onClick={() => void onConfirm()}
            >
              {busy ? (
                <LoaderCircleIcon aria-hidden className="animate-spin" />
              ) : null}
              Usar esta imagen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
