'use client'

import { PlusIcon, Trash2Icon } from 'lucide-react'
import {
  Controller,
  useFieldArray,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from 'react-hook-form'
import { FieldError } from '@/components/dashboard/store/field-error'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type {
  ProductFormInput,
  ProductFormValues,
} from '@/lib/validations/menu'

interface OptionGroupsEditorProps {
  control: Control<ProductFormInput, unknown, ProductFormValues>
  register: UseFormRegister<ProductFormInput>
  errors: FieldErrors<ProductFormInput>
}

const EMPTY_VALUE = { name: '', price_delta: 0 }
const EMPTY_GROUP = {
  name: '',
  required: false,
  min: 0,
  max: 1,
  values: [{ ...EMPTY_VALUE }],
}

function OptionValues({
  groupIndex,
  control,
  register,
  errors,
}: OptionGroupsEditorProps & { groupIndex: number }) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `options.${groupIndex}.values`,
  })
  const groupErrors = errors.options?.[groupIndex]

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium">Opciones</p>
      <ul className="space-y-2">
        {fields.map((field, valueIndex) => {
          const valueErrors = groupErrors?.values?.[valueIndex]
          const nameId = `option-${groupIndex}-value-${valueIndex}-name`
          const deltaId = `option-${groupIndex}-value-${valueIndex}-delta`
          return (
            <li
              key={field.id}
              className="grid grid-cols-[1fr_120px_auto] gap-2"
            >
              <div className="space-y-1">
                <Label htmlFor={nameId} className="sr-only">
                  Nombre de la opción
                </Label>
                <Input
                  id={nameId}
                  placeholder="Ej. Grande"
                  maxLength={40}
                  aria-invalid={Boolean(valueErrors?.name)}
                  className="rounded-control h-10"
                  {...register(
                    `options.${groupIndex}.values.${valueIndex}.name`,
                  )}
                />
                <FieldError
                  id={`${nameId}-error`}
                  message={valueErrors?.name?.message}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={deltaId} className="sr-only">
                  Precio adicional
                </Label>
                <Input
                  id={deltaId}
                  type="number"
                  inputMode="numeric"
                  step={100}
                  placeholder="+ $"
                  aria-invalid={Boolean(valueErrors?.price_delta)}
                  className="rounded-control h-10"
                  {...register(
                    `options.${groupIndex}.values.${valueIndex}.price_delta`,
                    { valueAsNumber: true },
                  )}
                />
                <FieldError
                  id={`${deltaId}-error`}
                  message={valueErrors?.price_delta?.message}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Quitar opción"
                disabled={fields.length === 1}
                onClick={() => remove(valueIndex)}
              >
                <Trash2Icon aria-hidden="true" />
              </Button>
            </li>
          )
        })}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="xs"
        className="rounded-pill"
        onClick={() => append({ ...EMPTY_VALUE })}
      >
        <PlusIcon aria-hidden="true" />
        Agregar opción
      </Button>
    </div>
  )
}

/** Nested field arrays: option groups, each with its own values. */
export function OptionGroupsEditor({
  control,
  register,
  errors,
}: OptionGroupsEditorProps) {
  const { fields, append, remove } = useFieldArray({ control, name: 'options' })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Grupos de opciones</h3>
          <p className="text-muted-foreground text-xs">
            Tamaños, adiciones o términos de cocción que el cliente elige.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-pill"
          onClick={() =>
            append({ ...EMPTY_GROUP, values: [{ ...EMPTY_VALUE }] })
          }
        >
          <PlusIcon aria-hidden="true" />
          Grupo
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="text-muted-foreground rounded-control bg-muted/50 px-3 py-4 text-center text-xs">
          Este producto no tiene opciones. Agrega un grupo si el cliente debe
          elegir algo.
        </p>
      ) : null}

      {fields.map((field, groupIndex) => {
        const groupErrors = errors.options?.[groupIndex]
        const nameId = `option-${groupIndex}-name`
        const minId = `option-${groupIndex}-min`
        const maxId = `option-${groupIndex}-max`
        const requiredId = `option-${groupIndex}-required`
        return (
          <fieldset
            key={field.id}
            className="rounded-control border-border/70 space-y-3 border p-3"
          >
            <legend className="sr-only">
              Grupo de opciones {groupIndex + 1}
            </legend>
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor={nameId}>Nombre del grupo</Label>
                <Input
                  id={nameId}
                  placeholder="Ej. Tamaño"
                  maxLength={40}
                  aria-invalid={Boolean(groupErrors?.name)}
                  className="rounded-control h-10"
                  {...register(`options.${groupIndex}.name`)}
                />
                <FieldError
                  id={`${nameId}-error`}
                  message={groupErrors?.name?.message}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Eliminar grupo"
                onClick={() => remove(groupIndex)}
              >
                <Trash2Icon aria-hidden="true" className="text-destructive" />
              </Button>
            </div>

            <div className="grid grid-cols-[auto_1fr_1fr] items-end gap-3">
              <div className="flex items-center gap-2 pb-2">
                <Controller
                  control={control}
                  name={`options.${groupIndex}.required`}
                  render={({ field: requiredField }) => (
                    <Switch
                      id={requiredId}
                      size="sm"
                      checked={requiredField.value}
                      onCheckedChange={requiredField.onChange}
                    />
                  )}
                />
                <Label htmlFor={requiredId} className="text-xs">
                  Obligatorio
                </Label>
              </div>
              <div className="space-y-1">
                <Label htmlFor={minId} className="text-xs">
                  Mínimo
                </Label>
                <Input
                  id={minId}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={20}
                  aria-invalid={Boolean(groupErrors?.min)}
                  className="rounded-control h-10"
                  {...register(`options.${groupIndex}.min`, {
                    valueAsNumber: true,
                  })}
                />
                <FieldError
                  id={`${minId}-error`}
                  message={groupErrors?.min?.message}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={maxId} className="text-xs">
                  Máximo
                </Label>
                <Input
                  id={maxId}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={20}
                  aria-invalid={Boolean(groupErrors?.max)}
                  className="rounded-control h-10"
                  {...register(`options.${groupIndex}.max`, {
                    valueAsNumber: true,
                  })}
                />
                <FieldError
                  id={`${maxId}-error`}
                  message={groupErrors?.max?.message}
                />
              </div>
            </div>
            <FieldError
              id={`option-${groupIndex}-values-error`}
              message={
                groupErrors?.values?.root?.message ??
                groupErrors?.values?.message
              }
            />

            <OptionValues
              groupIndex={groupIndex}
              control={control}
              register={register}
              errors={errors}
            />
          </fieldset>
        )
      })}
    </div>
  )
}
