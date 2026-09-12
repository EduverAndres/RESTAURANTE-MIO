'use client'

import {
  ChevronDownIcon,
  ChevronUpIcon,
  ImageIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Switch } from '@/components/ui/switch'
import { formatCOP } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ProductWithOptions } from '@/types/app'

interface ProductListProps {
  title: string
  products: ProductWithOptions[]
  pending: boolean
  canCreate: boolean
  onCreate: () => void
  onEdit: (product: ProductWithOptions) => void
  onMove: (product: ProductWithOptions, direction: 'up' | 'down') => void
  onToggleAvailability: (product: ProductWithOptions, next: boolean) => void
  onDelete: (product: ProductWithOptions) => void
}

/** Right column of the menu manager: products of the selected category. */
export function ProductList({
  title,
  products,
  pending,
  canCreate,
  onCreate,
  onEdit,
  onMove,
  onToggleAvailability,
  onDelete,
}: ProductListProps) {
  return (
    <section
      aria-labelledby="products-title"
      className="rounded-card border-border bg-card shadow-soft border p-4 sm:p-5"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id="products-title" className="font-display text-xl font-semibold">
          {title}
        </h2>
        {canCreate ? (
          <Button
            type="button"
            size="sm"
            className="rounded-pill"
            onClick={onCreate}
          >
            <PlusIcon aria-hidden="true" />
            Nuevo producto
          </Button>
        ) : null}
      </div>

      {products.length === 0 ? (
        <EmptyState
          title="Todavía no hay productos aquí"
          description={
            canCreate
              ? 'Agrega tu primer producto con nombre, precio y una foto que abra el apetito.'
              : 'Crea una categoría para empezar a cargar productos.'
          }
          className="py-10"
        />
      ) : (
        <ul className="divide-border/60 divide-y" aria-label="Productos">
          {products.map((product, index) => (
            <li
              key={product.id}
              className={cn(
                'flex items-center gap-3 py-3',
                !product.is_available && 'opacity-60',
              )}
            >
              <div className="bg-muted relative size-14 shrink-0 overflow-hidden rounded-[10px]">
                {product.image_url ? (
                  <Image
                    src={product.image_url}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                ) : (
                  <ImageIcon
                    aria-hidden="true"
                    className="text-muted-foreground absolute inset-0 m-auto size-5"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{product.name}</p>
                <p className="text-muted-foreground text-xs">
                  {formatCOP(Number(product.price))}
                  {product.product_options.length > 0
                    ? ` · ${product.product_options.length} grupo${product.product_options.length === 1 ? '' : 's'} de opciones`
                    : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Switch
                  size="sm"
                  aria-label={`Disponible: ${product.name}`}
                  checked={product.is_available}
                  disabled={pending}
                  onCheckedChange={(next) =>
                    onToggleAvailability(product, next)
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Subir ${product.name}`}
                  disabled={pending || index === 0}
                  onClick={() => onMove(product, 'up')}
                >
                  <ChevronUpIcon aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Bajar ${product.name}`}
                  disabled={pending || index === products.length - 1}
                  onClick={() => onMove(product, 'down')}
                >
                  <ChevronDownIcon aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Editar ${product.name}`}
                  disabled={pending}
                  onClick={() => onEdit(product)}
                >
                  <PencilIcon aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Eliminar ${product.name}`}
                  disabled={pending}
                  onClick={() => onDelete(product)}
                >
                  <Trash2Icon aria-hidden="true" className="text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
