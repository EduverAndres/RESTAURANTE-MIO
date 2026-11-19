import type { Metadata } from 'next'
import { ReviewVisibilityButton } from '@/components/admin/review-visibility-button'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { requireRole } from '@/lib/auth'
import { formatDateCO } from '@/lib/format-date'
import { createAdminClient } from '@/lib/supabase/admin'
import { throwOnQueryError } from '@/lib/supabase/query-error'

export const metadata: Metadata = { title: 'Reseñas de platos' }
export const dynamic = 'force-dynamic'

const LIMIT = 100

/**
 * Moderation of dish reviews. Reviews are hidden, never deleted: a hidden one
 * stays on record but leaves the storefront and the dish's average.
 */
export default async function AdminReviewsPage() {
  await requireRole(['admin'], '/admin/reviews')
  const { data, error } = await createAdminClient()
    .from('product_reviews')
    .select(
      'id, rating, comment, author_first_name, hidden_at, created_at, products(name), stores(name)',
    )
    .order('created_at', { ascending: false })
    .limit(LIMIT)
  throwOnQueryError(error, 'admin product reviews')
  const reviews = data ?? []

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-h1 font-display font-semibold">
          Reseñas de platos
        </h1>
        <p className="text-muted-foreground text-sm">
          Las últimas {LIMIT}. Ocultar retira la reseña de la tienda y del
          promedio del plato sin borrarla.
        </p>
      </header>

      {reviews.length === 0 ? (
        <EmptyState
          title="Todavía no hay reseñas de platos"
          description="Aparecerán aquí cuando los clientes califiquen lo que pidieron."
        />
      ) : (
        <div className="rounded-card bg-card shadow-1 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plato</TableHead>
                <TableHead>Tienda</TableHead>
                <TableHead>Calificación</TableHead>
                <TableHead>Comentario</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviews.map((review) => {
                const dish = review.products?.name ?? 'Plato eliminado'
                const hidden = review.hidden_at !== null
                return (
                  <TableRow
                    key={review.id}
                    data-hidden={hidden || undefined}
                    className={hidden ? 'opacity-60' : undefined}
                  >
                    <TableCell className="font-medium">{dish}</TableCell>
                    <TableCell>{review.stores?.name ?? '—'}</TableCell>
                    <TableCell className="tabular-nums">
                      <span aria-hidden="true">
                        {'★'.repeat(review.rating)}
                      </span>
                      <span className="sr-only">
                        {review.rating} de 5 estrellas
                      </span>
                    </TableCell>
                    <TableCell className="max-w-sm text-sm whitespace-normal">
                      {review.comment ?? (
                        <span className="text-muted-foreground">
                          Sin comentario
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{review.author_first_name ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {formatDateCO(review.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <ReviewVisibilityButton
                        reviewId={review.id}
                        hidden={hidden}
                        dishName={dish}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
