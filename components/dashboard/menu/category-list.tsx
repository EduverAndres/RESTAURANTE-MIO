'use client'

import {
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
  EyeOffIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { MenuCategory } from '@/types/app'

export const UNCATEGORIZED_KEY = 'sin-categoria'

interface CategoryListProps {
  categories: MenuCategory[]
  productCounts: Record<string, number>
  uncategorizedCount: number
  selectedKey: string
  pending: boolean
  onSelect: (key: string) => void
  onCreate: () => void
  onRename: (category: MenuCategory) => void
  onMove: (category: MenuCategory, direction: 'up' | 'down') => void
  onToggleVisibility: (category: MenuCategory) => void
  onDelete: (category: MenuCategory) => void
}

function IconAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      {children}
    </Button>
  )
}

/** Left column of the menu manager: ordered categories with row actions. */
export function CategoryList({
  categories,
  productCounts,
  uncategorizedCount,
  selectedKey,
  pending,
  onSelect,
  onCreate,
  onRename,
  onMove,
  onToggleVisibility,
  onDelete,
}: CategoryListProps) {
  return (
    <section
      aria-labelledby="categories-title"
      className="rounded-card border-border bg-card shadow-soft border p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2
          id="categories-title"
          className="font-display text-xl font-semibold"
        >
          Categorías
        </h2>
        <Button
          type="button"
          size="sm"
          className="rounded-pill"
          onClick={onCreate}
        >
          <PlusIcon aria-hidden="true" />
          Nueva
        </Button>
      </div>

      {categories.length === 0 ? (
        <p className="text-muted-foreground px-1 py-6 text-center text-sm">
          Crea tu primera categoría para empezar a cargar productos.
        </p>
      ) : (
        <ul className="space-y-1" aria-label="Lista de categorías">
          {categories.map((category, index) => {
            const selected = selectedKey === category.id
            return (
              <li key={category.id}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  onClick={() => onSelect(category.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelect(category.id)
                    }
                  }}
                  className={cn(
                    'rounded-control focus-visible:ring-primary flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm transition-colors outline-none focus-visible:ring-2',
                    selected
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted text-foreground',
                    !category.is_visible && 'opacity-60',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {category.name}
                    <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                      {productCounts[category.id] ?? 0}
                    </span>
                  </span>
                  <div className="flex shrink-0 items-center">
                    <IconAction
                      label={`Subir ${category.name}`}
                      disabled={pending || index === 0}
                      onClick={() => onMove(category, 'up')}
                    >
                      <ChevronUpIcon aria-hidden="true" />
                    </IconAction>
                    <IconAction
                      label={`Bajar ${category.name}`}
                      disabled={pending || index === categories.length - 1}
                      onClick={() => onMove(category, 'down')}
                    >
                      <ChevronDownIcon aria-hidden="true" />
                    </IconAction>
                    <IconAction
                      label={
                        category.is_visible
                          ? `Ocultar ${category.name}`
                          : `Mostrar ${category.name}`
                      }
                      disabled={pending}
                      onClick={() => onToggleVisibility(category)}
                    >
                      {category.is_visible ? (
                        <EyeIcon aria-hidden="true" />
                      ) : (
                        <EyeOffIcon aria-hidden="true" />
                      )}
                    </IconAction>
                    <IconAction
                      label={`Renombrar ${category.name}`}
                      disabled={pending}
                      onClick={() => onRename(category)}
                    >
                      <PencilIcon aria-hidden="true" />
                    </IconAction>
                    <IconAction
                      label={`Eliminar ${category.name}`}
                      disabled={pending}
                      onClick={() => onDelete(category)}
                    >
                      <Trash2Icon
                        aria-hidden="true"
                        className="text-destructive"
                      />
                    </IconAction>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {uncategorizedCount > 0 ? (
        <button
          type="button"
          aria-pressed={selectedKey === UNCATEGORIZED_KEY}
          onClick={() => onSelect(UNCATEGORIZED_KEY)}
          className={cn(
            'rounded-control mt-3 flex w-full items-center justify-between px-2 py-1.5 text-sm transition-colors',
            selectedKey === UNCATEGORIZED_KEY
              ? 'bg-primary/10 text-primary'
              : 'hover:bg-muted text-muted-foreground',
          )}
        >
          <span>Sin categoría</span>
          <span className="text-xs">{uncategorizedCount}</span>
        </button>
      ) : null}
    </section>
  )
}
