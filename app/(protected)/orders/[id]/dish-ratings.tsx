'use client'

import { StarIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { DISH_COMMENT_MAX } from '@/lib/reviews/dish-rating'
import { cn } from '@/lib/utils'

export interface ReviewableDish {
  /** The order line the review is attached to. */
  orderItemId: string
  name: string
}

export interface DishRating {
  rating: number
  comment: string
}

const LABELS = ['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente']

/**
 * Optional per-dish ratings under the restaurant's stars. Nothing here is
 * required: a customer who only wants to rate the restaurant scrolls past.
 * Each dish is its own radio group; a comment opens on demand and is capped
 * at DISH_COMMENT_MAX, the same limit the server and the database enforce.
 */
export function DishRatings({
  dishes,
  value,
  onChange,
}: {
  dishes: ReviewableDish[]
  value: Record<string, DishRating>
  onChange: (orderItemId: string, next: DishRating) => void
}) {
  if (dishes.length === 0) return null
  return (
    <fieldset className="border-border space-y-3 border-t pt-4">
      <legend className="pb-1 text-sm font-semibold">
        ¿Y los platos?{' '}
        <span className="text-muted-foreground font-normal">(opcional)</span>
      </legend>
      <ul className="space-y-3">
        {dishes.map((dish) => (
          <li key={dish.orderItemId}>
            <DishRow
              dish={dish}
              value={value[dish.orderItemId] ?? { rating: 0, comment: '' }}
              onChange={(next) => onChange(dish.orderItemId, next)}
            />
          </li>
        ))}
      </ul>
    </fieldset>
  )
}

function DishRow({
  dish,
  value,
  onChange,
}: {
  dish: ReviewableDish
  value: DishRating
  onChange: (next: DishRating) => void
}) {
  const nameId = useId()
  const commentId = useId()
  const [commenting, setCommenting] = useState(value.comment.length > 0)
  const remaining = DISH_COMMENT_MAX - value.comment.length

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span id={nameId} className="min-w-0 text-sm font-medium">
          {dish.name}
        </span>
        <div
          role="radiogroup"
          aria-labelledby={nameId}
          className="flex items-center gap-0.5"
        >
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={value.rating === star}
              aria-label={`${dish.name}: ${star} ${star === 1 ? 'estrella' : 'estrellas'}, ${LABELS[star]}`}
              onClick={() =>
                // Tapping the chosen star again clears it: optional means undoable.
                onChange({ ...value, rating: value.rating === star ? 0 : star })
              }
              className="rounded-full p-1.5"
            >
              <StarIcon
                aria-hidden="true"
                className={cn(
                  'size-5 transition-colors',
                  star <= value.rating
                    ? 'fill-accent text-accent-strong'
                    : 'text-muted-foreground/40',
                )}
              />
            </button>
          ))}
        </div>
      </div>
      {value.rating > 0 ? (
        commenting ? (
          <div className="space-y-1">
            <Textarea
              id={commentId}
              aria-label={`Comentario sobre ${dish.name}`}
              aria-describedby={`${commentId}-count`}
              value={value.comment}
              maxLength={DISH_COMMENT_MAX}
              onChange={(event) =>
                onChange({ ...value, comment: event.target.value })
              }
              placeholder={`¿Qué tal ${dish.name}?`}
              className="rounded-control min-h-16 text-sm"
            />
            <p
              id={`${commentId}-count`}
              className="text-muted-foreground text-right text-xs tabular-nums"
            >
              {remaining} {remaining === 1 ? 'carácter' : 'caracteres'}{' '}
              disponibles
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCommenting(true)}
            className="text-primary-on-tint text-xs font-medium underline-offset-4 hover:underline"
          >
            Agregar comentario sobre {dish.name}
          </button>
        )
      ) : null}
    </div>
  )
}
