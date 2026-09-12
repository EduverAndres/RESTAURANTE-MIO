'use client'

import {
  ChevronDownIcon,
  ChevronUpIcon,
  GripVerticalIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { foldText } from '@/lib/store/search'
import { cn } from '@/lib/utils'

/**
 * The featured strip: which products go in it and in what order.
 *
 * Ordering has the same two paths as the section list — drag for a mouse,
 * subir / bajar for a keyboard — and the picker refuses to go past the twelve
 * product cap the theme schema enforces, so the editor can never build a
 * selection the server would reject.
 */

/** The twelve cap comes from `storeThemeSchema.featured.productIds`. */
export const MAX_FEATURED = 12

export interface FeaturedProductOption {
  id: string
  name: string
  categoryName: string | null
}

function move<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length) return [...list]
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(Math.min(to, next.length), 0, item)
  return next
}

export function FeaturedPicker({
  products,
  value,
  onChange,
}: {
  products: readonly FeaturedProductOption[]
  value: string[]
  onChange: (value: string[]) => void
}) {
  const searchId = useId()
  const [query, setQuery] = useState('')
  const [dragging, setDragging] = useState<number | null>(null)

  const byId = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  )

  const full = value.length >= MAX_FEATURED
  const needle = foldText(query)
  const candidates = useMemo(
    () =>
      products
        .filter((product) => !value.includes(product.id))
        .filter(
          (product) =>
            needle.length === 0 ||
            foldText(product.name).includes(needle) ||
            foldText(product.categoryName ?? '').includes(needle),
        )
        .slice(0, 8),
    [products, value, needle],
  )

  if (products.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Todavía no tienes productos. Agrégalos desde Menú y vuelve aquí para
        destacarlos.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <ol aria-label="Productos destacados" className="space-y-1">
        {value.map((id, index) => {
          const product = byId.get(id)
          return (
            <li
              key={id}
              draggable
              onDragStart={(event) => {
                setDragging(index)
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', id)
              }}
              onDragEnd={() => setDragging(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                if (dragging !== null) onChange(move(value, dragging, index))
                setDragging(null)
              }}
              className={cn(
                'bg-muted/50 border-border flex items-center gap-2 rounded-[var(--radius-md)] border px-2 py-1.5 text-sm',
                dragging === index && 'opacity-50',
              )}
            >
              <GripVerticalIcon
                aria-hidden
                className="text-muted-foreground size-4 shrink-0 cursor-grab"
              />
              <span className="text-muted-foreground w-4 shrink-0 text-xs tabular-nums">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {product?.name ?? 'Producto eliminado'}
              </span>
              <span className="flex shrink-0 items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Subir ${product?.name ?? 'producto'}`}
                  disabled={index === 0}
                  onClick={() => onChange(move(value, index, index - 1))}
                >
                  <ChevronUpIcon aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Bajar ${product?.name ?? 'producto'}`}
                  disabled={index === value.length - 1}
                  onClick={() => onChange(move(value, index, index + 1))}
                >
                  <ChevronDownIcon aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Quitar ${product?.name ?? 'producto'}`}
                  onClick={() => onChange(value.filter((item) => item !== id))}
                >
                  <XIcon aria-hidden />
                </Button>
              </span>
            </li>
          )
        })}
      </ol>

      {value.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Sin destacados, la franja no se muestra en la tienda.
        </p>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor={searchId} className="text-sm leading-none font-medium">
          Agregar un producto
        </label>
        <div className="relative">
          <SearchIcon
            aria-hidden
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            id={searchId}
            type="search"
            value={query}
            disabled={full}
            placeholder="Busca por nombre o categoría"
            className="rounded-control h-10 pl-9"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <p className="text-muted-foreground text-xs" role="status">
          {full
            ? `Llegaste al máximo de ${MAX_FEATURED} productos destacados.`
            : `${value.length} de ${MAX_FEATURED} destacados.`}
        </p>
      </div>

      {!full ? (
        <ul className="space-y-1">
          {candidates.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                onClick={() => onChange([...value, product.id])}
                className="border-border hover:bg-muted/60 focus-visible:ring-ring/50 flex w-full items-center gap-2 rounded-[var(--radius-md)] border px-2 py-1.5 text-left text-sm outline-none focus-visible:ring-3"
              >
                <PlusIcon
                  aria-hidden
                  className="text-primary size-4 shrink-0"
                />
                <span className="min-w-0 flex-1 truncate">{product.name}</span>
                {product.categoryName ? (
                  <span className="text-muted-foreground shrink-0 truncate text-xs">
                    {product.categoryName}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
          {candidates.length === 0 ? (
            <li className="text-muted-foreground px-2 py-1.5 text-xs">
              No encontramos productos con ese nombre.
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
