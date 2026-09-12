'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircleIcon } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { FieldError } from '@/components/dashboard/store/field-error'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { categorySchema, type CategoryInput } from '@/lib/validations/menu'

interface CategoryDialogProps {
  open: boolean
  /** Null creates a category; a name edits the existing one. */
  initialName: string | null
  pending: boolean
  onSubmit: (values: CategoryInput) => void
  onOpenChange: (open: boolean) => void
}

export function CategoryDialog({
  open,
  initialName,
  pending,
  onSubmit,
  onOpenChange,
}: CategoryDialogProps) {
  const editing = initialName !== null
  const form = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: initialName ?? '' },
  })

  useEffect(() => {
    if (open) form.reset({ name: initialName ?? '' })
  }, [open, initialName, form])

  const error = form.formState.errors.name?.message

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-card sm:max-w-md">
        <form
          onSubmit={form.handleSubmit((values) => onSubmit(values))}
          noValidate
          className="space-y-5"
        >
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {editing ? 'Renombrar categoría' : 'Nueva categoría'}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? 'El nuevo nombre se verá de inmediato en tu tienda.'
                : 'Agrupa tus productos, por ejemplo Entradas o Bebidas.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="category-name">Nombre</Label>
            <Input
              id="category-name"
              autoFocus
              maxLength={40}
              aria-invalid={Boolean(error)}
              aria-describedby="category-name-error"
              className="rounded-control h-11"
              {...form.register('name')}
            />
            <FieldError id="category-name-error" message={error} />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="rounded-pill"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending} className="rounded-pill">
              {pending ? (
                <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
              ) : null}
              {editing ? 'Guardar' : 'Crear categoría'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
