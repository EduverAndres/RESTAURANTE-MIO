'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircleIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { updateStore } from './actions'
import { ScheduleEditor } from '@/components/dashboard/store/schedule-editor'
import { StoreBasicsFields } from '@/components/dashboard/store/store-basics-fields'
import { StoreLogisticsFields } from '@/components/dashboard/store/store-logistics-fields'
import { Button } from '@/components/ui/button'
import {
  createStoreSchema,
  formToSchedule,
  scheduleSchema,
  type CreateStoreInput,
  type CreateStoreValues,
  type ScheduleForm,
} from '@/lib/validations/store'
import type { WeekDay } from '@/types/app'

interface StoreFormProps {
  storeId: string
  defaults: CreateStoreInput
  schedule: ScheduleForm
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-card border-border bg-card shadow-soft space-y-5 border p-5 sm:p-6">
      <header className="space-y-1">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </header>
      {children}
    </section>
  )
}

export function StoreForm({ storeId, defaults, schedule }: StoreFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [scheduleForm, setScheduleForm] = useState(schedule)
  const [scheduleDirty, setScheduleDirty] = useState(false)
  const [scheduleErrors, setScheduleErrors] = useState<
    Partial<Record<WeekDay, string>>
  >({})

  const form = useForm<CreateStoreInput, unknown, CreateStoreValues>({
    resolver: zodResolver(createStoreSchema),
    defaultValues: defaults,
  })

  const onSubmit = form.handleSubmit((values) => {
    const scheduleValue = formToSchedule(scheduleForm)
    const parsedSchedule = scheduleSchema.safeParse(scheduleValue)
    if (!parsedSchedule.success) {
      const errors: Partial<Record<WeekDay, string>> = {}
      for (const issue of parsedSchedule.error.issues) {
        const day = issue.path[0] as WeekDay
        errors[day] ??= issue.message
      }
      setScheduleErrors(errors)
      toast.error('Revisa los horarios marcados.')
      return
    }
    setScheduleErrors({})

    startTransition(async () => {
      const result = await updateStore(storeId, {
        ...values,
        description: values.description ?? '',
        whatsapp_phone: values.whatsapp_phone ?? '',
        schedule: parsedSchedule.data,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Tienda actualizada.')
      form.reset(form.getValues())
      setScheduleDirty(false)
      router.refresh()
    })
  })

  const dirty = form.formState.isDirty || scheduleDirty

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Section
        title="Datos públicos"
        description="Lo que ven tus clientes en la tienda y en el listado."
      >
        <StoreBasicsFields form={form} excludeStoreId={storeId} />
      </Section>

      <Section
        title="Ubicación y entregas"
        description="Define desde dónde despachas y las condiciones del domicilio."
      >
        <StoreLogisticsFields form={form} />
      </Section>

      <Section
        title="Horarios"
        description="Activa los días que abres y ajusta las horas de atención."
      >
        <ScheduleEditor
          value={scheduleForm}
          errors={scheduleErrors}
          onChange={(next) => {
            setScheduleForm(next)
            setScheduleDirty(true)
          }}
        />
      </Section>

      <div className="bg-background/80 sticky bottom-0 -mx-4 flex justify-end border-t px-4 py-3 backdrop-blur-md sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none">
        <Button
          type="submit"
          disabled={pending || !dirty}
          className="rounded-pill"
        >
          {pending ? (
            <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
          ) : null}
          Guardar cambios
        </Button>
      </div>
    </form>
  )
}
