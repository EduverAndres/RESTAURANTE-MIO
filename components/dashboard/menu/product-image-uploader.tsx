'use client'

import { ImageIcon, LoaderCircleIcon, UploadIcon } from 'lucide-react'
import Image from 'next/image'
import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { uploadProductImage } from '@/app/dashboard/menu/actions'
import { Button } from '@/components/ui/button'
import { ACCEPTED_IMAGE_TYPES, validateImageFile } from '@/lib/uploads/image'

interface ProductImageUploaderProps {
  storeId: string
  /** Null while the product has not been created yet (nothing to attach). */
  productId: string | null
  currentUrl: string | null
  onUploaded?: (url: string) => void
}

/** Square preview + file input; uploads to `product-images/${storeId}/…`. */
export function ProductImageUploader({
  storeId,
  productId,
  currentUrl,
  onUploaded,
}: ProductImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState(currentUrl)
  const [pending, startTransition] = useTransition()

  function handleFile(file: File | undefined) {
    if (!file || !productId) return
    const valid = validateImageFile(file)
    if (!valid.ok) {
      toast.error(valid.error)
      return
    }
    const formData = new FormData()
    formData.set('storeId', storeId)
    formData.set('productId', productId)
    formData.set('file', file)
    startTransition(async () => {
      const result = await uploadProductImage(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setUrl(result.url)
      onUploaded?.(result.url)
      toast.success('Imagen actualizada.')
    })
  }

  return (
    <div className="flex items-start gap-4">
      <div className="rounded-card bg-muted/50 ring-foreground/10 relative size-28 shrink-0 overflow-hidden ring-1">
        {url ? (
          <Image
            src={url}
            alt="Imagen del producto"
            fill
            sizes="112px"
            className="object-cover"
          />
        ) : (
          <div className="text-muted-foreground flex h-full w-full items-center justify-center">
            <ImageIcon aria-hidden="true" className="size-7" />
          </div>
        )}
        {pending ? (
          <div className="bg-background/70 absolute inset-0 flex items-center justify-center">
            <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
          </div>
        ) : null}
      </div>
      <div className="space-y-2">
        <input
          ref={inputRef}
          id="product-image"
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          className="sr-only"
          onChange={(event) => {
            handleFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-pill"
          disabled={pending || !productId}
          onClick={() => inputRef.current?.click()}
        >
          <UploadIcon aria-hidden="true" />
          {url ? 'Cambiar imagen' : 'Subir imagen'}
        </Button>
        <p className="text-muted-foreground text-xs">
          {productId
            ? 'Cuadrada o 4:3. PNG, JPG o WebP hasta 3 MB.'
            : 'Guarda el producto y luego podrás subir su imagen.'}
        </p>
      </div>
    </div>
  )
}
