'use client'

import { ImageIcon, LoaderCircleIcon, UploadIcon } from 'lucide-react'
import Image from 'next/image'
import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { uploadStoreAsset } from '@/app/dashboard/store/actions'
import { Button } from '@/components/ui/button'
import { ACCEPTED_IMAGE_TYPES, validateImageFile } from '@/lib/uploads/image'
import { cn } from '@/lib/utils'
import type { StoreAssetKind } from '@/lib/validations/store'

interface StoreAssetUploaderProps {
  storeId: string
  kind: StoreAssetKind
  currentUrl: string | null
  onUploaded?: (url: string) => void
}

const COPY: Record<StoreAssetKind, { label: string; hint: string }> = {
  logo: { label: 'Logo', hint: 'Cuadrado, mínimo 256 px. PNG, JPG o WebP.' },
  cover: {
    label: 'Portada',
    hint: 'Horizontal, ideal 1600 × 600. Hasta 3 MB.',
  },
}

/** File input with preview; uploads through the server action on change. */
export function StoreAssetUploader({
  storeId,
  kind,
  currentUrl,
  onUploaded,
}: StoreAssetUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState(currentUrl)
  const [pending, startTransition] = useTransition()
  const inputId = `store-asset-${kind}`
  const copy = COPY[kind]

  function handleFile(file: File | undefined) {
    if (!file) return
    const valid = validateImageFile(file)
    if (!valid.ok) {
      toast.error(valid.error)
      return
    }
    const formData = new FormData()
    formData.set('storeId', storeId)
    formData.set('kind', kind)
    formData.set('file', file)
    startTransition(async () => {
      const result = await uploadStoreAsset(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setUrl(result.url)
      onUploaded?.(result.url)
      toast.success(`${copy.label} actualizado.`)
    })
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{copy.label}</p>
      <div
        className={cn(
          'rounded-card bg-muted/50 ring-foreground/10 relative overflow-hidden ring-1',
          kind === 'logo' ? 'size-32' : 'aspect-[8/3] w-full',
        )}
      >
        {url ? (
          <Image
            src={url}
            alt={`${copy.label} de la tienda`}
            fill
            sizes={
              kind === 'logo' ? '128px' : '(min-width: 1024px) 640px, 100vw'
            }
            className="object-cover"
          />
        ) : (
          <div className="text-muted-foreground flex h-full w-full items-center justify-center">
            <ImageIcon aria-hidden="true" className="size-8" />
          </div>
        )}
        {pending ? (
          <div className="bg-background/70 absolute inset-0 flex items-center justify-center">
            <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
          </div>
        ) : null}
      </div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        className="sr-only"
        onChange={(event) => {
          handleFile(event.target.files?.[0])
          event.target.value = ''
        }}
      />
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-pill"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          <UploadIcon aria-hidden="true" />
          {url ? 'Cambiar' : 'Subir'} {copy.label.toLowerCase()}
        </Button>
        <p className="text-muted-foreground text-xs">{copy.hint}</p>
      </div>
    </div>
  )
}
