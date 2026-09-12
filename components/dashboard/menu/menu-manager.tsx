'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  renameCategory,
  reorderCategories,
  reorderProducts,
  saveProductOptions,
  setCategoryVisibility,
  setProductAvailability,
  updateProduct,
} from '@/app/dashboard/menu/actions'
import { CategoryDialog } from '@/components/dashboard/menu/category-dialog'
import {
  CategoryList,
  UNCATEGORIZED_KEY,
} from '@/components/dashboard/menu/category-list'
import { ConfirmDeleteDialog } from '@/components/dashboard/menu/confirm-delete-dialog'
import { ProductList } from '@/components/dashboard/menu/product-list'
import { ProductSheet } from '@/components/dashboard/menu/product-sheet'
import { moveItem, positionUpdates } from '@/lib/menu/reorder'
import type { ProductFormValues } from '@/lib/validations/menu'
import type {
  MenuCategory,
  MenuCategoryWithProducts,
  ProductWithOptions,
} from '@/types/app'

interface MenuManagerProps {
  storeId: string
  categories: MenuCategoryWithProducts[]
  uncategorized: ProductWithOptions[]
}

type CategoryDialogState =
  { open: false } | { open: true; category: MenuCategory | null }

type Deletion =
  | { kind: 'category'; category: MenuCategory }
  | { kind: 'product'; product: ProductWithOptions }

type SheetState =
  { open: false } | { open: true; product: ProductWithOptions | null }

type ActionResult = { ok: true } | { ok: false; error: string }

/** Two-column menu editor; server state is refreshed after every action. */
export function MenuManager({
  storeId,
  categories,
  uncategorized,
}: MenuManagerProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selectedKey, setSelectedKey] = useState<string>(
    categories[0]?.id ?? UNCATEGORIZED_KEY,
  )
  const [categoryDialog, setCategoryDialog] = useState<CategoryDialogState>({
    open: false,
  })
  const [deletion, setDeletion] = useState<Deletion | null>(null)
  const [sheet, setSheet] = useState<SheetState>({ open: false })

  const selectedCategory =
    categories.find((category) => category.id === selectedKey) ??
    (selectedKey === UNCATEGORIZED_KEY ? null : (categories[0] ?? null))
  const effectiveKey = selectedCategory?.id ?? UNCATEGORIZED_KEY
  const products = selectedCategory ? selectedCategory.products : uncategorized

  const productCounts = useMemo(
    () =>
      Object.fromEntries(
        categories.map((category) => [category.id, category.products.length]),
      ),
    [categories],
  )

  function run(
    action: () => Promise<ActionResult>,
    success: string,
    after?: () => void,
  ) {
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      if (success) toast.success(success)
      after?.()
      router.refresh()
    })
  }

  function submitProduct(values: ProductFormValues) {
    if (!sheet.open) return
    const { options, ...product } = values
    const input = {
      ...product,
      description: product.description ?? '',
      tags: product.tags.join(', '),
    }
    const editing = sheet.product
    startTransition(async () => {
      let productId = editing?.id ?? null
      if (editing) {
        const result = await updateProduct(storeId, editing.id, input)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
      } else {
        const result = await createProduct(storeId, input)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        productId = result.id
        // The row exists now: switch to edit mode before saving options so a
        // retry after a failure updates this product instead of creating twice.
        setSheet({ open: true, product: result.product })
      }
      if (productId && (options.length > 0 || editing)) {
        const result = await saveProductOptions(storeId, productId, options)
        if (!result.ok) {
          toast.error(result.error)
          if (!editing) {
            // Keep the sheet open in edit mode; the list already has the row.
            setSelectedKey(product.category_id ?? UNCATEGORIZED_KEY)
            router.refresh()
          }
          return
        }
      }
      toast.success(
        editing
          ? 'Producto actualizado.'
          : 'Producto creado. Ábrelo para subir su imagen.',
      )
      setSheet({ open: false })
      if (product.category_id) setSelectedKey(product.category_id)
      else setSelectedKey(UNCATEGORIZED_KEY)
      router.refresh()
    })
  }

  function confirmDeletion() {
    if (!deletion) return
    const target = deletion
    setDeletion(null)
    if (target.kind === 'category') {
      run(
        () => deleteCategory(storeId, target.category.id),
        'Categoría eliminada.',
        () => {
          if (selectedKey === target.category.id)
            setSelectedKey(categories[0]?.id ?? UNCATEGORIZED_KEY)
        },
      )
    } else {
      run(
        () => deleteProduct(storeId, target.product.id),
        'Producto eliminado.',
      )
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr] lg:items-start">
      <CategoryList
        categories={categories}
        productCounts={productCounts}
        uncategorizedCount={uncategorized.length}
        selectedKey={effectiveKey}
        pending={pending}
        onSelect={setSelectedKey}
        onCreate={() => setCategoryDialog({ open: true, category: null })}
        onRename={(category) => setCategoryDialog({ open: true, category })}
        onMove={(category, direction) => {
          const updates = positionUpdates(
            moveItem(categories, category.id, direction),
          )
          if (updates.length === 0) return
          run(() => reorderCategories(storeId, updates), '')
        }}
        onToggleVisibility={(category) =>
          run(
            () =>
              setCategoryVisibility(storeId, category.id, !category.is_visible),
            category.is_visible ? 'Categoría oculta.' : 'Categoría visible.',
          )
        }
        onDelete={(category) => setDeletion({ kind: 'category', category })}
      />

      <ProductList
        title={selectedCategory?.name ?? 'Sin categoría'}
        products={products}
        pending={pending}
        canCreate={categories.length > 0 || uncategorized.length > 0}
        onCreate={() => setSheet({ open: true, product: null })}
        onEdit={(product) => setSheet({ open: true, product })}
        onMove={(product, direction) => {
          const updates = positionUpdates(
            moveItem(products, product.id, direction),
          )
          if (updates.length === 0) return
          run(() => reorderProducts(storeId, updates), '')
        }}
        onToggleAvailability={(product, next) =>
          run(
            () => setProductAvailability(storeId, product.id, next),
            next ? 'Producto disponible.' : 'Producto agotado.',
          )
        }
        onDelete={(product) => setDeletion({ kind: 'product', product })}
      />

      <CategoryDialog
        open={categoryDialog.open}
        initialName={
          categoryDialog.open ? (categoryDialog.category?.name ?? null) : null
        }
        pending={pending}
        onOpenChange={(open) => {
          if (!open) setCategoryDialog({ open: false })
        }}
        onSubmit={(values) => {
          if (!categoryDialog.open) return
          const existing = categoryDialog.category
          run(
            () =>
              existing
                ? renameCategory(storeId, existing.id, values)
                : createCategory(storeId, values).then((result) => {
                    if (result.ok) setSelectedKey(result.id)
                    return result
                  }),
            existing ? 'Categoría renombrada.' : 'Categoría creada.',
            () => setCategoryDialog({ open: false }),
          )
        }}
      />

      <ProductSheet
        open={sheet.open}
        storeId={storeId}
        categories={categories}
        product={sheet.open ? sheet.product : null}
        defaultCategoryId={selectedCategory?.id ?? null}
        pending={pending}
        onSubmit={submitProduct}
        onImageUploaded={() => router.refresh()}
        onOpenChange={(open) => {
          if (!open) setSheet({ open: false })
        }}
      />

      <ConfirmDeleteDialog
        open={deletion !== null}
        title={
          deletion?.kind === 'category'
            ? `Eliminar la categoría ${deletion.category.name}`
            : `Eliminar ${deletion?.kind === 'product' ? deletion.product.name : 'el producto'}`
        }
        description={
          deletion?.kind === 'category'
            ? 'Los productos que contiene quedarán sin categoría y dejarán de verse en la tienda hasta que los reasignes.'
            : 'El producto desaparecerá de tu carta. Los pedidos anteriores conservan su nombre y precio.'
        }
        onConfirm={confirmDeletion}
        onOpenChange={(open) => {
          if (!open) setDeletion(null)
        }}
      />
    </div>
  )
}
