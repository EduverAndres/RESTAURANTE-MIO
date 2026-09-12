'use client'

import { CheckCircle2Icon, LoaderCircleIcon, XCircleIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { checkSlugAvailability } from '@/app/dashboard/store/actions'
import { FieldError } from '@/components/dashboard/store/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { describedBy, errorId } from '@/lib/a11y/forms'
import { isValidSlug } from '@/lib/slug'
import {
  STORE_CATEGORIES,
  deriveSlug,
  type StoreBasicsInput,
} from '@/lib/validations/store'

type SlugState = 'idle' | 'checking' | 'available' | 'taken'

interface StoreBasicsFieldsProps {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  form: UseFormReturn<any>
  /** Store being edited; its own slug never counts as taken. */
  excludeStoreId?: string
  /** Suggest the slug from the name until the merchant edits it. */
  autoSlug?: boolean
  idPrefix?: string
}

function useSlugAvailability(
  form: UseFormReturn<StoreBasicsInput>,
  excludeStoreId?: string,
): SlugState {
  const slug = form.watch('slug')
  const [state, setState] = useState<SlugState>('idle')
  const requestRef = useRef(0)

  useEffect(() => {
    const value = (slug ?? '').trim()
    if (!isValidSlug(value)) {
      setState('idle')
      return
    }
    const request = ++requestRef.current
    setState('checking')
    const timer = setTimeout(async () => {
      const result = await checkSlugAvailability(value, excludeStoreId)
      if (request !== requestRef.current) return
      if (!result.ok) {
        setState('idle')
        return
      }
      setState(result.available ? 'available' : 'taken')
      if (!result.available) {
        form.setError('slug', {
          type: 'manual',
          message: 'Esa dirección web ya está en uso. Prueba con otra.',
        })
      } else if (form.formState.errors.slug?.type === 'manual') {
        form.clearErrors('slug')
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [slug, excludeStoreId, form])

  return state
}

/**
 * Availability of the chosen address, resolved asynchronously.
 *
 * A live region because it is the answer to something the merchant just did
 * and nothing else on the page says it: without this, "En uso" appeared next
 * to the label and a screen reader user typed on unaware.
 */
function SlugHint({ state, id }: { state: SlugState; id: string }) {
  return (
    <span id={id} role="status" className="flex items-center gap-1 text-xs">
      {state === 'checking' ? (
        <span className="text-muted-foreground flex items-center gap-1">
          <LoaderCircleIcon
            aria-hidden="true"
            className="size-3 animate-spin"
          />
          Verificando…
        </span>
      ) : null}
      {state === 'available' ? (
        <span className="text-success flex items-center gap-1">
          <CheckCircle2Icon aria-hidden="true" className="size-3" />
          Disponible
        </span>
      ) : null}
      {state === 'taken' ? (
        <span className="text-destructive flex items-center gap-1">
          <XCircleIcon aria-hidden="true" className="size-3" />
          En uso
        </span>
      ) : null}
    </span>
  )
}

export function StoreBasicsFields({
  form: untypedForm,
  excludeStoreId,
  autoSlug = false,
  idPrefix = 'store',
}: StoreBasicsFieldsProps) {
  const form = untypedForm as UseFormReturn<StoreBasicsInput>
  const slugState = useSlugAvailability(form, excludeStoreId)
  const [slugTouched, setSlugTouched] = useState(!autoSlug)
  const { errors } = form.formState
  const category = form.watch('category')

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-name`}>Nombre del restaurante</Label>
        <Input
          id={`${idPrefix}-name`}
          autoComplete="organization"
          placeholder="La Parrilla del Norte"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={`${idPrefix}-name-error`}
          className="rounded-control h-11"
          {...form.register('name', {
            onChange: (event) => {
              if (!slugTouched) {
                form.setValue('slug', deriveSlug(event.target.value), {
                  shouldValidate: true,
                })
              }
            },
          })}
        />
        <FieldError
          id={`${idPrefix}-name-error`}
          message={errors.name?.message}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`${idPrefix}-slug`}>Dirección web</Label>
          <SlugHint state={slugState} id={`${idPrefix}-slug-availability`} />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground text-sm">/t/</span>
          <Input
            id={`${idPrefix}-slug`}
            autoCapitalize="none"
            spellCheck={false}
            placeholder="la-parrilla-del-norte"
            aria-invalid={Boolean(errors.slug)}
            aria-describedby={describedBy(
              `${idPrefix}-slug-help`,
              `${idPrefix}-slug-availability`,
              Boolean(errors.slug) && errorId(`${idPrefix}-slug`),
            )}
            className="rounded-control h-11 font-mono text-sm"
            {...form.register('slug', {
              onChange: () => setSlugTouched(true),
            })}
          />
        </div>
        <p
          id={`${idPrefix}-slug-help`}
          className="text-muted-foreground text-xs"
        >
          Solo minúsculas, números y guiones. Tus clientes entrarán por esta
          dirección.
        </p>
        <FieldError
          id={`${idPrefix}-slug-error`}
          message={errors.slug?.message}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-category`}>Categoría</Label>
        <Select
          value={category || undefined}
          onValueChange={(value) =>
            form.setValue('category', value, {
              shouldValidate: true,
              shouldDirty: true,
            })
          }
        >
          <SelectTrigger
            id={`${idPrefix}-category`}
            aria-invalid={Boolean(errors.category)}
            aria-describedby={`${idPrefix}-category-error`}
            className="rounded-control h-11 w-full"
          >
            <SelectValue placeholder="Elige una categoría" />
          </SelectTrigger>
          <SelectContent>
            {STORE_CATEGORIES.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError
          id={`${idPrefix}-category-error`}
          message={errors.category?.message}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-description`}>
          Descripción{' '}
          <span className="text-muted-foreground font-normal">(opcional)</span>
        </Label>
        <Textarea
          id={`${idPrefix}-description`}
          rows={3}
          maxLength={300}
          placeholder="Cuenta en una frase qué hace especial a tu cocina."
          aria-invalid={Boolean(errors.description)}
          aria-describedby={`${idPrefix}-description-error`}
          className="rounded-control"
          {...form.register('description')}
        />
        <FieldError
          id={`${idPrefix}-description-error`}
          message={errors.description?.message}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-whatsapp`}>
          WhatsApp del restaurante{' '}
          <span className="text-muted-foreground font-normal">(opcional)</span>
        </Label>
        <Input
          id={`${idPrefix}-whatsapp`}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+57 300 123 4567"
          aria-invalid={Boolean(errors.whatsapp_phone)}
          aria-describedby={`${idPrefix}-whatsapp-error`}
          className="rounded-control h-11"
          {...form.register('whatsapp_phone')}
        />
        <FieldError
          id={`${idPrefix}-whatsapp-error`}
          message={errors.whatsapp_phone?.message}
        />
      </div>
    </div>
  )
}
