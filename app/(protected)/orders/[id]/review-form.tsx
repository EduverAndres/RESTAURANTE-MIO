'use client'

import { LoaderCircleIcon, StarIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { submitReview } from './actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const LABELS = ['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente']

export function ReviewForm({
  orderId,
  storeName,
}: {
  orderId: string
  storeName: string
}) {
  const router = useRouter()
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [pending, startTransition] = useTransition()

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (rating === 0) {
      toast.error('Elige una calificación.')
      return
    }
    startTransition(async () => {
      const result = await submitReview({ orderId, rating, comment })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('¡Gracias por tu valoración!')
      router.refresh()
    })
  }

  const shown = hover || rating

  return (
    <form
      onSubmit={submit}
      className="rounded-card border-border bg-card shadow-soft space-y-4 border p-5"
    >
      <div>
        <h2 className="font-display text-2xl font-semibold">
          ¿Cómo estuvo {storeName}?
        </h2>
        <p className="text-muted-foreground text-sm">
          Tu valoración ayuda a otros clientes y al restaurante.
        </p>
      </div>
      <div
        role="radiogroup"
        aria-label="Calificación"
        className="flex items-center gap-1"
      >
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            aria-label={`${value} ${value === 1 ? 'estrella' : 'estrellas'}: ${LABELS[value]}`}
            onMouseEnter={() => setHover(value)}
            onMouseLeave={() => setHover(0)}
            onFocus={() => setHover(value)}
            onBlur={() => setHover(0)}
            onClick={() => setRating(value)}
            className="rounded-full p-1 transition-transform hover:scale-110"
          >
            <StarIcon
              aria-hidden="true"
              className={cn(
                'size-8 transition-colors',
                value <= shown
                  ? 'fill-accent text-accent'
                  : 'text-muted-foreground/40',
              )}
            />
          </button>
        ))}
        <span className="text-muted-foreground ml-2 text-sm" aria-live="polite">
          {LABELS[shown]}
        </span>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="review-comment">
          Comentario{' '}
          <span className="text-muted-foreground font-normal">(opcional)</span>
        </Label>
        <Textarea
          id="review-comment"
          value={comment}
          maxLength={500}
          onChange={(event) => setComment(event.target.value)}
          placeholder="¿Qué te gustó? ¿Qué mejorarías?"
          className="rounded-control min-h-20"
        />
      </div>
      <Button type="submit" disabled={pending} className="rounded-pill">
        {pending ? (
          <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
        ) : null}
        Enviar valoración
      </Button>
    </form>
  )
}
