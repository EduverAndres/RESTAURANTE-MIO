'use client'

import { HeartIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useOptimistic, useTransition } from 'react'
import { toast } from 'sonner'
import { toggleFavorite } from '@/app/(public)/actions'
import { cn } from '@/lib/utils'

interface FavoriteButtonProps {
  storeId: string
  storeName: string
  initial: boolean
  className?: string
}

export function FavoriteButton({
  storeId,
  storeName,
  initial,
  className,
}: FavoriteButtonProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [favorite, setOptimistic] = useOptimistic(initial)

  function onClick(event: React.MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    startTransition(async () => {
      setOptimistic(!favorite)
      const result = await toggleFavorite(storeId)
      if (!result.ok) {
        if (result.error === 'unauthenticated') {
          toast('Inicia sesión para guardar favoritos.')
          router.push('/login?next=%2F')
        } else {
          toast.error('No pudimos guardar el favorito.')
        }
        return
      }
      toast.success(
        result.favorite
          ? `${storeName} guardado en favoritos.`
          : 'Quitado de favoritos.',
      )
    })
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={favorite}
      aria-label={
        favorite
          ? `Quitar ${storeName} de favoritos`
          : `Guardar ${storeName} en favoritos`
      }
      className={cn(
        'rounded-pill inline-flex size-9 items-center justify-center bg-black/45 text-white backdrop-blur-sm transition-transform hover:scale-105 active:scale-95',
        className,
      )}
    >
      <HeartIcon
        aria-hidden="true"
        className={cn(
          'size-4 transition-colors',
          favorite && 'fill-red-500 text-red-500',
        )}
      />
    </button>
  )
}
