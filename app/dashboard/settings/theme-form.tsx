'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircleIcon, RotateCcwIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { updateStoreTheme } from './actions'
import { ColorField } from '@/components/dashboard/theme/color-field'
import { SectionOrderField } from '@/components/dashboard/theme/section-order-field'
import { ThemePreview } from '@/components/dashboard/theme/theme-preview'
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
  storeThemeSchema,
  type StoreThemeInput,
  type StoreThemeValues,
} from '@/lib/validations/theme'
import {
  DEFAULT_STORE_THEME,
  THEME_BANNER_LAYOUTS,
  THEME_BUTTON_STYLES,
  THEME_FONTS,
  type StoreTheme,
  type ThemeBannerLayout,
  type ThemeButtonStyle,
} from '@/types/app'

interface ThemeFormProps {
  storeId: string
  storeName: string
  category: string | null
  theme: StoreTheme
}

const COLOR_FIELDS: { key: keyof StoreThemeInput & string; label: string }[] = [
  { key: 'primary', label: 'Color principal' },
  { key: 'accent', label: 'Color de acento' },
  { key: 'background', label: 'Fondo' },
  { key: 'surface', label: 'Tarjetas' },
  { key: 'text', label: 'Texto' },
]

const BUTTON_STYLE_LABELS: Record<ThemeButtonStyle, string> = {
  pill: 'Redondeado (píldora)',
  rounded: 'Esquinas suaves',
  square: 'Recto',
}

const BANNER_LAYOUT_LABELS: Record<ThemeBannerLayout, string> = {
  full: 'Portada completa',
  split: 'Dividida',
  compact: 'Compacta',
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-card border-border bg-card shadow-soft space-y-4 border p-5">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      {children}
    </section>
  )
}

export function ThemeForm({
  storeId,
  storeName,
  category,
  theme,
}: ThemeFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const form = useForm<StoreThemeInput, unknown, StoreThemeValues>({
    resolver: zodResolver(storeThemeSchema),
    defaultValues: theme,
  })
  const live = form.watch()
  const { errors, isDirty } = form.formState

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await updateStoreTheme(storeId, values)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Tema guardado.')
      form.reset(values)
      router.refresh()
    })
  })

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start"
    >
      <div className="space-y-6">
        <Section title="Colores">
          <div className="grid gap-4 sm:grid-cols-2">
            {COLOR_FIELDS.map(({ key, label }) => (
              <Controller
                key={key}
                control={form.control}
                name={key as 'primary'}
                render={({ field }) => (
                  <ColorField
                    id={`theme-${key}`}
                    label={label}
                    value={field.value}
                    error={errors[key as 'primary']?.message}
                    onChange={field.onChange}
                  />
                )}
              />
            ))}
          </div>
        </Section>

        <Section title="Tipografía y formas">
          <div className="grid gap-4 sm:grid-cols-2">
            {(['fontDisplay', 'fontBody'] as const).map((key) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`theme-${key}`}>
                  {key === 'fontDisplay' ? 'Títulos' : 'Texto'}
                </Label>
                <Controller
                  control={form.control}
                  name={key}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        id={`theme-${key}`}
                        className="rounded-control h-11 w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {THEME_FONTS.map((font) => (
                          <SelectItem key={font} value={font}>
                            {font}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError
                  id={`theme-${key}-error`}
                  message={errors[key]?.message}
                />
              </div>
            ))}

            <div className="space-y-1.5">
              <Label htmlFor="theme-buttonStyle">Botones</Label>
              <Controller
                control={form.control}
                name="buttonStyle"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="theme-buttonStyle"
                      className="rounded-control h-11 w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {THEME_BUTTON_STYLES.map((style) => (
                        <SelectItem key={style} value={style}>
                          {BUTTON_STYLE_LABELS[style]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="theme-radius">Radio de las tarjetas (px)</Label>
              <Input
                id="theme-radius"
                type="number"
                inputMode="numeric"
                min={0}
                max={64}
                aria-invalid={Boolean(errors.radius)}
                aria-describedby="theme-radius-error"
                className="rounded-control h-11"
                {...form.register('radius', { valueAsNumber: true })}
              />
              <FieldError
                id="theme-radius-error"
                message={errors.radius?.message}
              />
            </div>
          </div>
        </Section>

        <Section title="Portada">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="theme-banner-layout">Diseño</Label>
              <Controller
                control={form.control}
                name="banner.layout"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="theme-banner-layout"
                      className="rounded-control h-11 w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {THEME_BANNER_LAYOUTS.map((layout) => (
                        <SelectItem key={layout} value={layout}>
                          {BANNER_LAYOUT_LABELS[layout]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="theme-overlay">
                Oscurecido de la portada (
                {Math.round((live.banner?.overlayOpacity ?? 0) * 100)}%)
              </Label>
              <input
                id="theme-overlay"
                type="range"
                min={0}
                max={1}
                step={0.05}
                className="accent-primary h-11 w-full"
                {...form.register('banner.overlayOpacity', {
                  valueAsNumber: true,
                })}
              />
              <FieldError
                id="theme-overlay-error"
                message={errors.banner?.overlayOpacity?.message}
              />
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            La imagen de portada y el logo se cambian desde la sección Tienda.
          </p>
        </Section>

        <Section title="Orden de las secciones">
          <Controller
            control={form.control}
            name="sectionOrder"
            render={({ field }) => (
              <SectionOrderField
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <FieldError
            id="theme-sectionOrder-error"
            message={errors.sectionOrder?.message}
          />
        </Section>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            disabled={pending || !isDirty}
            className="rounded-pill"
          >
            {pending ? (
              <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
            ) : null}
            Guardar tema
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="rounded-pill"
            disabled={pending}
            onClick={() =>
              form.reset(
                {
                  ...DEFAULT_STORE_THEME,
                  banner: {
                    ...DEFAULT_STORE_THEME.banner,
                    imageUrl: theme.banner.imageUrl,
                  },
                  logoUrl: theme.logoUrl,
                },
                { keepDefaultValues: true },
              )
            }
          >
            <RotateCcwIcon aria-hidden="true" />
            Restablecer
          </Button>
        </div>
      </div>

      <aside className="space-y-2 lg:sticky lg:top-24">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Vista previa
        </p>
        <ThemePreview theme={live} storeName={storeName} category={category} />
      </aside>
    </form>
  )
}
