'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircleIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { OptionGroupsEditor } from '@/components/dashboard/menu/option-groups-editor'
import { ProductImageUploader } from '@/components/dashboard/menu/product-image-uploader'
import { FieldError } from '@/components/dashboard/store/field-error'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { describedBy } from '@/lib/a11y/forms'
import { formatTags } from '@/lib/menu/tags'
import {
  productFormSchema,
  type ProductFormInput,
  type ProductFormValues,
} from '@/lib/validations/menu'
import type { MenuCategory, ProductWithOptions } from '@/types/app'

const NO_CATEGORY = 'none'
const NEW_PRODUCT_KEY = 'new'

interface ProductSheetProps {
  open: boolean
  storeId: string
  categories: MenuCategory[]
  /** Null creates a product in `defaultCategoryId`. */
  product: ProductWithOptions | null
  defaultCategoryId: string | null
  pending: boolean
  onSubmit: (values: ProductFormValues) => void
  onImageUploaded: () => void
  onOpenChange: (open: boolean) => void
}

function toFormValues(
  product: ProductWithOptions | null,
  defaultCategoryId: string | null,
): ProductFormInput {
  if (!product) {
    return {
      name: '',
      description: '',
      price: Number.NaN,
      is_available: true,
      tags: '',
      category_id: defaultCategoryId,
      options: [],
    }
  }
  return {
    name: product.name,
    description: product.description ?? '',
    price: Number(product.price),
    is_available: product.is_available,
    tags: formatTags(product.tags ?? []),
    category_id: product.category_id,
    options: [...product.product_options]
      .sort((a, b) => a.position - b.position)
      .map((group) => ({
        id: group.id,
        name: group.name,
        required: group.required,
        min: group.min,
        max: group.max,
        values: [...group.product_option_values]
          .sort((a, b) => a.position - b.position)
          .map((value) => ({
            id: value.id,
            name: value.name,
            price_delta: Number(value.price_delta),
          })),
      })),
  }
}

/** Create/edit drawer for a product, including its option groups. */
export function ProductSheet({
  open,
  storeId,
  categories,
  product,
  defaultCategoryId,
  pending,
  onSubmit,
  onImageUploaded,
  onOpenChange,
}: ProductSheetProps) {
  const form = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: toFormValues(product, defaultCategoryId),
  })

  // Tracks which product the form was last reset for ('new' while creating).
  // When the parent swaps a just-created row in for `null` the user's typed
  // values (including option groups) must survive, so that transition skips
  // the reset; any other change still resets as before.
  const resetForRef = useRef<string | null>(null)
  useEffect(() => {
    if (!open) {
      resetForRef.current = null
      return
    }
    const key = product?.id ?? NEW_PRODUCT_KEY
    if (resetForRef.current === NEW_PRODUCT_KEY && product) {
      resetForRef.current = key
      return
    }
    resetForRef.current = key
    form.reset(toFormValues(product, defaultCategoryId))
  }, [open, product, defaultCategoryId, form])

  const { errors } = form.formState

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <form
          onSubmit={form.handleSubmit((values) => onSubmit(values))}
          noValidate
          className="flex min-h-full flex-col"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="font-display text-2xl">
              {product ? 'Editar producto' : 'Nuevo producto'}
            </SheetTitle>
            <SheetDescription>
              {product
                ? 'Los cambios se publican al guardar.'
                : 'Nombre, precio y opciones del plato.'}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 px-4 pb-4">
            <ProductImageUploader
              key={product?.id ?? NEW_PRODUCT_KEY}
              storeId={storeId}
              productId={product?.id ?? null}
              currentUrl={product?.image_url ?? null}
              onUploaded={onImageUploaded}
            />

            <div className="space-y-1.5">
              <Label htmlFor="product-name">Nombre</Label>
              <Input
                id="product-name"
                maxLength={80}
                aria-invalid={Boolean(errors.name)}
                aria-describedby="product-name-error"
                className="rounded-control h-11"
                {...form.register('name')}
              />
              <FieldError
                id="product-name-error"
                message={errors.name?.message}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="product-description">Descripción</Label>
              <Textarea
                id="product-description"
                rows={3}
                maxLength={300}
                placeholder="Ingredientes, porción, lo que lo hace especial…"
                aria-invalid={Boolean(errors.description)}
                aria-describedby="product-description-error"
                className="rounded-control"
                {...form.register('description')}
              />
              <FieldError
                id="product-description-error"
                message={errors.description?.message}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="product-price">Precio (COP)</Label>
                <Input
                  id="product-price"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={100}
                  aria-invalid={Boolean(errors.price)}
                  aria-describedby="product-price-error"
                  className="rounded-control h-11"
                  {...form.register('price', { valueAsNumber: true })}
                />
                <FieldError
                  id="product-price-error"
                  message={errors.price?.message}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="product-category">Categoría</Label>
                <Controller
                  control={form.control}
                  name="category_id"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? NO_CATEGORY}
                      onValueChange={(value) =>
                        field.onChange(value === NO_CATEGORY ? null : value)
                      }
                    >
                      <SelectTrigger
                        id="product-category"
                        aria-invalid={Boolean(errors.category_id)}
                        aria-describedby={describedBy(
                          Boolean(errors.category_id) &&
                            'product-category-error',
                        )}
                        className="rounded-control h-11 w-full"
                      >
                        <SelectValue placeholder="Sin categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_CATEGORY}>
                          Sin categoría
                        </SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError
                  id="product-category-error"
                  message={errors.category_id?.message}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="product-tags">Etiquetas</Label>
              <Input
                id="product-tags"
                placeholder="vegano, picante, nuevo"
                aria-describedby="product-tags-hint"
                className="rounded-control h-11"
                {...form.register('tags')}
              />
              <p
                id="product-tags-hint"
                className="text-muted-foreground text-xs"
              >
                Separadas por coma. Hasta 8 etiquetas cortas.
              </p>
            </div>

            <div className="rounded-control bg-muted/60 flex items-center justify-between gap-3 px-3 py-2.5">
              <div>
                <Label htmlFor="product-available" className="text-sm">
                  Disponible
                </Label>
                <p className="text-muted-foreground text-xs">
                  Los productos no disponibles se ocultan de la tienda.
                </p>
              </div>
              <Controller
                control={form.control}
                name="is_available"
                render={({ field }) => (
                  <Switch
                    id="product-available"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>

            <OptionGroupsEditor
              control={form.control}
              register={form.register}
              errors={errors}
            />
          </div>

          <SheetFooter className="border-border/60 bg-popover sticky bottom-0 border-t">
            <Button type="submit" disabled={pending} className="rounded-pill">
              {pending ? (
                <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
              ) : null}
              {product ? 'Guardar cambios' : 'Crear producto'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
