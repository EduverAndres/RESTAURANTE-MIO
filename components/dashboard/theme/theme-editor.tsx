'use client'

import {
  CodeIcon,
  EyeIcon,
  ImageIcon,
  LayoutListIcon,
  LoaderCircleIcon,
  PaletteIcon,
  RedoIcon,
  RotateCcwIcon,
  SettingsIcon,
  StoreIcon,
  TypeIcon,
  UndoIcon,
  UtensilsIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import { toast } from 'sonner'
import { AccessibilityPanel } from './accessibility-panel'
import { ColorField, useRecentColors } from './color-field'
import {
  EditorAccordion,
  EditorSection,
  SegmentedField,
  SliderField,
  SwitchField,
  TextAreaField,
  TextField,
} from './editor-primitives'
import { FeaturedPicker, type FeaturedProductOption } from './featured-picker'
import { FontPicker } from './font-picker'
import { ImageField } from './image-field'
import {
  BANNER_CROP_ASPECT,
  THEME_BADGE_STYLE_LABELS,
  THEME_BUTTON_STYLE_LABELS,
  THEME_FEATURED_LAYOUT_LABELS,
  THEME_HEADING_CASE_LABELS,
  THEME_HEADING_WEIGHT_LABELS,
  THEME_HERO_ALIGN_LABELS,
  THEME_IMAGE_RATIO_LABELS,
  THEME_LETTER_SPACING_LABELS,
  THEME_LOGO_SIZE_LABELS,
  THEME_MODE_LABELS,
  THEME_PRODUCT_HOVER_LABELS,
  THEME_SHOW_PRICES_LABELS,
} from './labels'
import { PaletteSuggestions } from './palette-suggestions'
import { PresetGallery } from './preset-gallery'
import { PreviewPane } from './preview-pane'
import { SectionOrderField } from './section-order-field'
import { ThemeIoControls } from './theme-io-controls'
import { updateStoreTheme } from '@/app/dashboard/settings/actions'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ensureReadable } from '@/lib/theme'
import {
  canRedo,
  canUndo,
  initHistory,
  pushHistory,
  redo,
  undo,
  type History,
} from '@/lib/theme/history'
import {
  THEME_PRESETS,
  applyPreset,
  type ThemePreset,
} from '@/lib/theme/presets'
import { storeThemeSchema } from '@/lib/validations/theme'
import {
  THEME_BADGE_STYLES,
  THEME_BANNER_LAYOUTS,
  THEME_BUTTON_STYLES,
  THEME_CARD_STYLES,
  THEME_CATEGORY_NAVS,
  THEME_DENSITIES,
  THEME_FEATURED_LAYOUTS,
  THEME_HEADING_CASES,
  THEME_HEADING_WEIGHTS,
  THEME_HERO_ALIGNS,
  THEME_IMAGE_RATIOS,
  THEME_IMAGE_SHAPES,
  THEME_LETTER_SPACINGS,
  THEME_LOGO_SIZES,
  THEME_MENU_LAYOUTS,
  THEME_MODES,
  THEME_MOTIONS,
  THEME_PATTERNS,
  THEME_PRODUCT_HOVERS,
  THEME_SHOW_PRICES,
  type StoreTheme,
} from '@/types/app'
import {
  THEME_BANNER_LAYOUT_LABELS,
  THEME_CARD_STYLE_LABELS,
  THEME_CATEGORY_NAV_LABELS,
  THEME_DENSITY_LABELS,
  THEME_IMAGE_SHAPE_LABELS,
  THEME_MENU_LAYOUT_LABELS,
  THEME_MOTION_LABELS,
  THEME_PATTERN_LABELS,
} from '@/lib/validations/theme'

/**
 * The theme editor.
 *
 * One object — the `StoreTheme` — is the single source of truth. Every control
 * is a controlled input over it, every change goes through `commit`, and the
 * preview is fed the same object. There is no form library and no duplicated
 * state, which is what makes undo, presets, import and the accessibility fixes
 * all work the same way: they hand back a new theme.
 *
 * `onPrimary` is the one field the merchant never sets. `ensureReadable` from
 * Phase 2 recomputes it on every commit, so the text on a button cannot end up
 * illegible no matter what else changes.
 */

/** Two edits of the same field within this window share one history entry. */
const COALESCE_MS = 700

/** Matches the `lg:` breakpoint the two-pane layout switches on. */
const DESKTOP_QUERY = '(min-width: 64rem)'

/**
 * Whether the two-pane layout is active.
 *
 * This decides *which* preview is mounted rather than which one is visible:
 * `hidden lg:block` would leave the desktop iframe in the DOM on a phone, and
 * a hidden iframe still loads the preview route, still listens for messages
 * and still writes the draft cookie. One pane, always.
 */
function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(false)
  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY)
    const sync = () => setDesktop(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])
  return desktop
}

const UNSAVED_WARNING = 'Tienes cambios sin guardar en el diseño de tu tienda.'

function choices<T extends string | number>(
  values: readonly T[],
  labels: Record<T, string>,
) {
  return values.map((value) => ({ value, label: labels[value] }))
}

export interface ThemeEditorProps {
  storeId: string
  storeSlug: string
  storeName: string
  theme: StoreTheme
  products: FeaturedProductOption[]
}

export default function ThemeEditor({
  storeId,
  storeSlug,
  storeName,
  theme: initialTheme,
  products,
}: ThemeEditorProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const { recent, remember } = useRecentColors()
  const desktop = useIsDesktop()

  const [history, setHistory] = useState<History<StoreTheme>>(() =>
    initHistory(initialTheme),
  )
  const [saved, setSaved] = useState(initialTheme)
  const [open, setOpen] = useState<string[]>(['identidad'])
  const [previewOpen, setPreviewOpen] = useState(false)
  const [logoColors, setLogoColors] = useState<string[]>([])

  const coalesceRef = useRef<{ key: string; at: number } | null>(null)
  const theme = history.present

  /**
   * Records a new theme. Consecutive edits of the same control inside
   * `COALESCE_MS` replace the current entry instead of stacking, so undoing a
   * typed tagline steps over the word rather than over each letter.
   */
  const commit = useCallback((next: StoreTheme, coalesceKey?: string) => {
    const readable = ensureReadable(next).theme
    setHistory((current) => {
      const last = coalesceRef.current
      const now = Date.now()
      const merge =
        coalesceKey !== undefined &&
        last !== null &&
        last.key === coalesceKey &&
        now - last.at < COALESCE_MS
      coalesceRef.current =
        coalesceKey === undefined ? null : { key: coalesceKey, at: now }
      return merge
        ? { ...current, present: readable, future: [] }
        : pushHistory(current, readable)
    })
  }, [])

  const patch = useCallback(
    (partial: Partial<StoreTheme>, coalesceKey?: string) => {
      commit({ ...theme, ...partial }, coalesceKey)
    },
    [commit, theme],
  )

  const dirty = useMemo(
    () => JSON.stringify(theme) !== JSON.stringify(saved),
    [theme, saved],
  )

  /** Zod issues by dotted path, so each control can show its own message. */
  const errors = useMemo(() => {
    const parsed = storeThemeSchema.safeParse(theme)
    if (parsed.success) return {} as Record<string, string>
    const map: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.')
      if (!(key in map)) map[key] = issue.message
    }
    return map
  }, [theme])

  const activePreset = useMemo(() => {
    const match = THEME_PRESETS.find(
      (preset) =>
        preset.theme.primary === theme.primary &&
        preset.theme.fontDisplay === theme.fontDisplay &&
        preset.theme.menuLayout === theme.menuLayout,
    )
    return match?.id ?? null
  }, [theme])

  // Warn before losing an unsaved draft.
  useEffect(() => {
    if (!dirty) return
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = UNSAVED_WARNING
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  // Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z, the way every editor behaves.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return
      const key = event.key.toLowerCase()
      if (key !== 'z' && key !== 'y') return
      event.preventDefault()
      coalesceRef.current = null
      setHistory((current) =>
        key === 'y' || event.shiftKey ? redo(current) : undo(current),
      )
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function onSave() {
    const parsed = storeThemeSchema.safeParse(theme)
    if (!parsed.success) {
      toast.error(
        parsed.error.issues[0]?.message ?? 'Revisa los datos del tema.',
      )
      return
    }
    startTransition(async () => {
      const result = await updateStoreTheme(storeId, theme)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setSaved(theme)
      toast.success('Tema guardado. Tus clientes ya lo ven.')
      router.refresh()
    })
  }

  function onPreset(preset: ThemePreset) {
    commit(applyPreset(theme, preset))
    toast.success(`Aplicamos el estilo ${preset.name}.`)
  }

  const colorTargets = {
    background: { label: 'Sobre el fondo', color: theme.background },
    surface: { label: 'Sobre las tarjetas', color: theme.surface },
  }

  const previewPane = (
    <PreviewPane
      slug={storeSlug}
      storeId={storeId}
      theme={theme}
      className="h-full"
    />
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-start">
      {/* ----------------------------------------------------------------- */}
      {/* Controls                                                           */}
      {/* ----------------------------------------------------------------- */}
      <div className="min-w-0 space-y-4">
        {/* Opaque on purpose: a translucent bar over the preset thumbnails
            made the save state hard to read. */}
        <div className="bg-card border-border shadow-2 sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border p-2">
          <Button
            type="button"
            onClick={onSave}
            disabled={pending || !dirty}
            className="rounded-pill"
          >
            {pending ? (
              <LoaderCircleIcon aria-hidden className="animate-spin" />
            ) : null}
            Guardar
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Deshacer"
            title="Deshacer (Ctrl+Z)"
            disabled={!canUndo(history)}
            onClick={() => {
              coalesceRef.current = null
              setHistory(undo)
            }}
          >
            <UndoIcon aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Rehacer"
            title="Rehacer (Ctrl+Shift+Z)"
            disabled={!canRedo(history)}
            onClick={() => {
              coalesceRef.current = null
              setHistory(redo)
            }}
          >
            <RedoIcon aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Volver a lo guardado"
            title="Volver a lo guardado"
            disabled={!dirty}
            onClick={() => commit(saved)}
          >
            <RotateCcwIcon aria-hidden />
          </Button>

          <p
            aria-live="polite"
            className="text-muted-foreground ml-auto pr-1 text-xs"
          >
            {dirty ? 'Cambios sin guardar' : 'Todo guardado'}
          </p>

          {/* On a phone the preview is a sheet instead of a second column. */}
          {desktop ? null : (
            <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-pill"
                >
                  <EyeIcon aria-hidden />
                  Ver
                </Button>
              </SheetTrigger>
              {/* The variant-prefixed height is deliberate: SheetContent sets
                  `data-[side=bottom]:h-auto`, which outranks a plain `h-*`. */}
              <SheetContent
                side="bottom"
                className="data-[side=bottom]:h-[88dvh]"
              >
                <SheetHeader>
                  <SheetTitle>Vista previa</SheetTitle>
                </SheetHeader>
                <div className="min-h-0 flex-1 px-4 pb-4">{previewPane}</div>
              </SheetContent>
            </Sheet>
          )}
        </div>

        <EditorAccordion value={open} onValueChange={setOpen}>
          {/* --------------------------------------------------------- */}
          <EditorSection
            value="identidad"
            title="Identidad"
            summary="Punto de partida, logo y modo de color"
            icon={StoreIcon}
          >
            <div className="space-y-2">
              <p className="text-sm leading-none font-medium">
                Elige un punto de partida
              </p>
              <PresetGallery activeId={activePreset} onApply={onPreset} />
            </div>

            <ImageField
              label="Logo"
              hint="Cuadrado, PNG o JPG de hasta 3 MB. Lo usamos en la portada y en la cabecera."
              storeId={storeId}
              kind="logo"
              value={theme.logoUrl}
              aspect={1}
              round
              onChange={(logoUrl) => patch({ logoUrl })}
              onColors={setLogoColors}
            />

            {logoColors.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-sm leading-none font-medium">
                  Colores de tu logo
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {logoColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        patch({ primary: color })
                        remember(color)
                      }}
                      className="border-border focus-visible:ring-ring/50 flex items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-1 text-xs outline-none focus-visible:ring-3"
                    >
                      <span
                        aria-hidden
                        className="size-5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-mono uppercase">{color}</span>
                    </button>
                  ))}
                </div>
                <p className="text-muted-foreground text-xs">
                  Toca uno para usarlo como color principal.
                </p>
              </div>
            ) : null}

            <SegmentedField
              label="Modo de color"
              value={theme.mode}
              options={choices(THEME_MODES, THEME_MODE_LABELS)}
              onChange={(mode) => patch({ mode })}
              hint="«Según el cliente» sigue la preferencia del teléfono de quien visita."
              columns={3}
            />
          </EditorSection>

          {/* --------------------------------------------------------- */}
          <EditorSection
            value="colores"
            title="Colores"
            summary="Marca, fondo, degradado y textura"
            icon={PaletteIcon}
          >
            <ColorField
              id="theme-primary"
              label="Color principal"
              value={theme.primary}
              error={errors.primary}
              recent={recent}
              hint="El color de los botones y los enlaces."
              onChange={(primary) => patch({ primary }, 'primary')}
              onCommit={remember}
            />

            <PaletteSuggestions
              primary={theme.primary}
              mode={theme.mode}
              onApply={(palette) => {
                commit({ ...theme, ...palette.colors })
                toast.success(
                  `Aplicamos la paleta ${palette.label.toLowerCase()}.`,
                )
              }}
            />

            <ColorField
              id="theme-secondary"
              label="Color secundario"
              value={theme.secondary}
              error={errors.secondary}
              recent={recent}
              against={[colorTargets.surface]}
              onChange={(secondary) => patch({ secondary }, 'secondary')}
              onCommit={remember}
            />
            <ColorField
              id="theme-accent"
              label="Color de acento"
              value={theme.accent}
              error={errors.accent}
              recent={recent}
              hint="Para los precios y los detalles que quieres resaltar."
              onChange={(accent) => patch({ accent }, 'accent')}
              onCommit={remember}
            />
            <ColorField
              id="theme-background"
              label="Fondo"
              value={theme.background}
              error={errors.background}
              recent={recent}
              onChange={(background) => patch({ background }, 'background')}
              onCommit={remember}
            />
            <ColorField
              id="theme-surface"
              label="Tarjetas"
              value={theme.surface}
              error={errors.surface}
              recent={recent}
              onChange={(surface) => patch({ surface }, 'surface')}
              onCommit={remember}
            />
            <ColorField
              id="theme-text"
              label="Texto"
              value={theme.text}
              error={errors.text}
              recent={recent}
              against={[colorTargets.background, colorTargets.surface]}
              onChange={(text) => patch({ text }, 'text')}
              onCommit={remember}
            />

            <SwitchField
              label="Degradado en la portada"
              hint="Pinta la portada con una mezcla de dos colores."
              checked={theme.gradient.enabled}
              onChange={(enabled) =>
                patch({ gradient: { ...theme.gradient, enabled } })
              }
            />
            {theme.gradient.enabled ? (
              <div className="space-y-4 border-l-2 pl-3">
                <ColorField
                  id="theme-gradient-from"
                  label="Desde"
                  value={theme.gradient.from}
                  error={errors['gradient.from']}
                  recent={recent}
                  onChange={(from) =>
                    patch(
                      { gradient: { ...theme.gradient, from } },
                      'gradientFrom',
                    )
                  }
                  onCommit={remember}
                />
                <ColorField
                  id="theme-gradient-to"
                  label="Hasta"
                  value={theme.gradient.to}
                  error={errors['gradient.to']}
                  recent={recent}
                  onChange={(to) =>
                    patch({ gradient: { ...theme.gradient, to } }, 'gradientTo')
                  }
                  onCommit={remember}
                />
                <SliderField
                  label="Inclinación"
                  value={theme.gradient.angle}
                  min={0}
                  max={360}
                  step={5}
                  format={(value) => `${value}°`}
                  onChange={(angle) =>
                    patch(
                      { gradient: { ...theme.gradient, angle } },
                      'gradientAngle',
                    )
                  }
                />
              </div>
            ) : null}

            <SegmentedField
              label="Textura de fondo"
              value={theme.pattern}
              options={choices(THEME_PATTERNS, THEME_PATTERN_LABELS)}
              onChange={(pattern) => patch({ pattern })}
              columns={3}
            />
            {theme.pattern !== 'none' ? (
              <SliderField
                label="Intensidad de la textura"
                value={theme.patternOpacity}
                min={0}
                max={0.2}
                step={0.01}
                format={(value) => `${Math.round(value * 500)}%`}
                onChange={(patternOpacity) =>
                  patch({ patternOpacity }, 'patternOpacity')
                }
              />
            ) : null}
          </EditorSection>

          {/* --------------------------------------------------------- */}
          <EditorSection
            value="tipografia"
            title="Tipografía"
            summary="Letras, grosor y esquinas"
            icon={TypeIcon}
          >
            <FontPicker
              display={theme.fontDisplay}
              body={theme.fontBody}
              onChange={(fonts) => patch(fonts)}
            />
            <SegmentedField
              label="Grosor de los títulos"
              value={theme.headingWeight}
              options={choices(
                THEME_HEADING_WEIGHTS,
                THEME_HEADING_WEIGHT_LABELS,
              )}
              onChange={(headingWeight) => patch({ headingWeight })}
            />
            <SegmentedField
              label="Mayúsculas en los títulos"
              value={theme.headingCase}
              options={choices(THEME_HEADING_CASES, THEME_HEADING_CASE_LABELS)}
              onChange={(headingCase) => patch({ headingCase })}
              columns={2}
            />
            <SegmentedField
              label="Espacio entre letras"
              value={theme.letterSpacing}
              options={choices(
                THEME_LETTER_SPACINGS,
                THEME_LETTER_SPACING_LABELS,
              )}
              onChange={(letterSpacing) => patch({ letterSpacing })}
              columns={3}
            />
            <SliderField
              label="Esquinas redondeadas"
              value={theme.radius}
              min={0}
              max={64}
              step={1}
              format={(value) => `${value} px`}
              error={errors.radius}
              onChange={(radius) => patch({ radius }, 'radius')}
            />
            <SegmentedField
              label="Forma de los botones"
              value={theme.buttonStyle}
              options={choices(THEME_BUTTON_STYLES, THEME_BUTTON_STYLE_LABELS)}
              onChange={(buttonStyle) => patch({ buttonStyle })}
              columns={3}
            />
          </EditorSection>

          {/* --------------------------------------------------------- */}
          <EditorSection
            value="portada"
            title="Portada"
            summary="La primera pantalla de tu tienda"
            icon={ImageIcon}
          >
            <SegmentedField
              label="Diseño de la portada"
              value={theme.banner.layout}
              options={choices(
                THEME_BANNER_LAYOUTS,
                THEME_BANNER_LAYOUT_LABELS,
              )}
              onChange={(layout) =>
                patch({ banner: { ...theme.banner, layout } })
              }
              columns={3}
            />

            <ImageField
              label="Imagen de portada"
              hint="Recórtala como se verá con el diseño que elegiste."
              storeId={storeId}
              kind="cover"
              value={theme.banner.imageUrl}
              aspect={BANNER_CROP_ASPECT[theme.banner.layout] ?? 16 / 9}
              onChange={(imageUrl) =>
                patch({ banner: { ...theme.banner, imageUrl } })
              }
            />

            <SliderField
              label="Oscurecido de la portada"
              value={theme.banner.overlayOpacity}
              min={0}
              max={1}
              step={0.05}
              format={(value) => `${Math.round(value * 100)}%`}
              hint="Súbelo si el texto no se lee bien sobre la foto."
              onChange={(overlayOpacity) =>
                patch(
                  { banner: { ...theme.banner, overlayOpacity } },
                  'overlay',
                )
              }
            />

            {theme.banner.layout === 'video' ? (
              <TextField
                label="Video de fondo (MP4)"
                value={theme.hero.videoUrl ?? ''}
                placeholder="https://…/portada.mp4"
                error={errors['hero.videoUrl']}
                hint="Solo MP4 servido por https."
                onChange={(value) =>
                  patch(
                    {
                      hero: {
                        ...theme.hero,
                        videoUrl: value.trim() === '' ? null : value,
                      },
                    },
                    'videoUrl',
                  )
                }
              />
            ) : null}

            <SegmentedField
              label="Alineación"
              value={theme.hero.align}
              options={choices(THEME_HERO_ALIGNS, THEME_HERO_ALIGN_LABELS)}
              onChange={(align) => patch({ hero: { ...theme.hero, align } })}
              columns={2}
            />
            <TextField
              label="Frase de bienvenida"
              value={theme.hero.tagline ?? ''}
              maxLength={80}
              placeholder="Arepas rellenas como en casa"
              error={errors['hero.tagline']}
              onChange={(value) =>
                patch(
                  {
                    hero: {
                      ...theme.hero,
                      tagline: value.trim() === '' ? null : value,
                    },
                  },
                  'tagline',
                )
              }
            />
            <TextField
              label="Texto del botón principal"
              value={theme.hero.ctaLabel ?? ''}
              maxLength={24}
              placeholder="Ver el menú"
              error={errors['hero.ctaLabel']}
              onChange={(value) =>
                patch(
                  {
                    hero: {
                      ...theme.hero,
                      ctaLabel: value.trim() === '' ? null : value,
                    },
                  },
                  'ctaLabel',
                )
              }
            />

            <SwitchField
              label="Mostrar el logo"
              checked={theme.hero.showLogo}
              onChange={(showLogo) =>
                patch({ hero: { ...theme.hero, showLogo } })
              }
            />
            {theme.hero.showLogo ? (
              <SegmentedField
                label="Tamaño del logo"
                value={theme.hero.logoSize}
                options={choices(THEME_LOGO_SIZES, THEME_LOGO_SIZE_LABELS)}
                onChange={(logoSize) =>
                  patch({ hero: { ...theme.hero, logoSize } })
                }
                columns={3}
              />
            ) : null}
            <SwitchField
              label="Mostrar la calificación"
              checked={theme.hero.showRating}
              onChange={(showRating) =>
                patch({ hero: { ...theme.hero, showRating } })
              }
            />
            <SwitchField
              label="Mostrar el tiempo de entrega"
              checked={theme.hero.showEta}
              onChange={(showEta) =>
                patch({ hero: { ...theme.hero, showEta } })
              }
            />
            <SwitchField
              label="Mostrar el horario"
              checked={theme.hero.showSchedule}
              onChange={(showSchedule) =>
                patch({ hero: { ...theme.hero, showSchedule } })
              }
            />
          </EditorSection>

          {/* --------------------------------------------------------- */}
          <EditorSection
            value="menu"
            title="Menú"
            summary="Cómo se ven y se ordenan tus productos"
            icon={UtensilsIcon}
          >
            <SegmentedField
              label="Disposición de los productos"
              value={theme.menuLayout}
              options={choices(THEME_MENU_LAYOUTS, THEME_MENU_LAYOUT_LABELS)}
              onChange={(menuLayout) => patch({ menuLayout })}
              columns={2}
            />
            <SegmentedField
              label="Navegación por categorías"
              value={theme.categoryNav}
              options={choices(THEME_CATEGORY_NAVS, THEME_CATEGORY_NAV_LABELS)}
              onChange={(categoryNav) => patch({ categoryNav })}
              columns={2}
            />
            <SegmentedField
              label="Forma de las fotos"
              value={theme.imageShape}
              options={choices(THEME_IMAGE_SHAPES, THEME_IMAGE_SHAPE_LABELS)}
              onChange={(imageShape) => patch({ imageShape })}
              columns={2}
            />
            <SegmentedField
              label="Proporción de las fotos"
              value={theme.imageRatio}
              options={choices(THEME_IMAGE_RATIOS, THEME_IMAGE_RATIO_LABELS)}
              onChange={(imageRatio) => patch({ imageRatio })}
              columns={4}
            />
            <SegmentedField
              label="Estilo de las tarjetas"
              value={theme.cardStyle}
              options={choices(THEME_CARD_STYLES, THEME_CARD_STYLE_LABELS)}
              onChange={(cardStyle) => patch({ cardStyle })}
              columns={2}
            />
            <SegmentedField
              label="Espacio entre elementos"
              value={theme.density}
              options={choices(THEME_DENSITIES, THEME_DENSITY_LABELS)}
              onChange={(density) => patch({ density })}
              columns={3}
            />
            <SegmentedField
              label="Efecto al pasar el cursor"
              value={theme.productHover}
              options={choices(
                THEME_PRODUCT_HOVERS,
                THEME_PRODUCT_HOVER_LABELS,
              )}
              onChange={(productHover) => patch({ productHover })}
              columns={2}
            />
            <SegmentedField
              label="Precios"
              value={theme.showPrices}
              options={choices(THEME_SHOW_PRICES, THEME_SHOW_PRICES_LABELS)}
              onChange={(showPrices) => patch({ showPrices })}
              columns={2}
            />
            <SegmentedField
              label="Estilo de las etiquetas"
              value={theme.badges.style}
              options={choices(THEME_BADGE_STYLES, THEME_BADGE_STYLE_LABELS)}
              onChange={(style) =>
                patch({ badges: { ...theme.badges, style } })
              }
              columns={3}
            />
            <SliderField
              label="Un producto es «nuevo» durante"
              value={theme.badges.newDays}
              min={0}
              max={60}
              step={1}
              format={(value) => (value === 0 ? 'nunca' : `${value} días`)}
              onChange={(newDays) =>
                patch({ badges: { ...theme.badges, newDays } }, 'newDays')
              }
            />
            <SwitchField
              label="Etiqueta «popular»"
              hint="La ponemos en los productos que más se piden."
              checked={theme.badges.popularEnabled}
              onChange={(popularEnabled) =>
                patch({ badges: { ...theme.badges, popularEnabled } })
              }
            />
          </EditorSection>

          {/* --------------------------------------------------------- */}
          <EditorSection
            value="secciones"
            title="Secciones"
            summary="Qué muestra tu tienda y en qué orden"
            icon={LayoutListIcon}
          >
            <SectionOrderField
              value={theme.sectionOrder}
              onChange={(sectionOrder) => patch({ sectionOrder })}
            />

            <div className="border-border space-y-4 border-t pt-4">
              <p className="text-sm leading-none font-medium">Destacados</p>
              <TextField
                label="Título de la franja"
                value={theme.featured.title}
                maxLength={60}
                error={errors['featured.title']}
                onChange={(title) =>
                  patch(
                    { featured: { ...theme.featured, title } },
                    'featuredTitle',
                  )
                }
              />
              <SegmentedField
                label="Diseño de la franja"
                value={theme.featured.layout}
                options={choices(
                  THEME_FEATURED_LAYOUTS,
                  THEME_FEATURED_LAYOUT_LABELS,
                )}
                onChange={(layout) =>
                  patch({ featured: { ...theme.featured, layout } })
                }
                columns={3}
              />
              <FeaturedPicker
                products={products}
                value={theme.featured.productIds}
                onChange={(productIds) =>
                  patch({ featured: { ...theme.featured, productIds } })
                }
              />
            </div>

            <div className="border-border space-y-4 border-t pt-4">
              <p className="text-sm leading-none font-medium">
                Nuestra historia
              </p>
              <SwitchField
                label="Contar tu historia"
                checked={theme.story.enabled}
                onChange={(enabled) =>
                  patch({ story: { ...theme.story, enabled } })
                }
              />
              {theme.story.enabled ? (
                <>
                  <TextField
                    label="Título"
                    value={theme.story.title}
                    maxLength={60}
                    error={errors['story.title']}
                    onChange={(title) =>
                      patch({ story: { ...theme.story, title } }, 'storyTitle')
                    }
                  />
                  <TextAreaField
                    label="Texto"
                    value={theme.story.text}
                    maxLength={600}
                    rows={5}
                    placeholder="Abrimos en 1998 en una esquina del barrio…"
                    error={errors['story.text']}
                    onChange={(text) =>
                      patch({ story: { ...theme.story, text } }, 'storyText')
                    }
                  />
                </>
              ) : null}
            </div>

            <div className="border-border space-y-4 border-t pt-4">
              <p className="text-sm leading-none font-medium">Redes sociales</p>
              <TextField
                label="Instagram"
                value={theme.social.instagram ?? ''}
                placeholder="@tutienda"
                error={errors['social.instagram']}
                onChange={(value) =>
                  patch(
                    {
                      social: {
                        ...theme.social,
                        instagram: value.trim() === '' ? null : value,
                      },
                    },
                    'instagram',
                  )
                }
              />
              <TextField
                label="TikTok"
                value={theme.social.tiktok ?? ''}
                placeholder="@tutienda"
                error={errors['social.tiktok']}
                onChange={(value) =>
                  patch(
                    {
                      social: {
                        ...theme.social,
                        tiktok: value.trim() === '' ? null : value,
                      },
                    },
                    'tiktok',
                  )
                }
              />
              <TextField
                label="Facebook"
                value={theme.social.facebook ?? ''}
                placeholder="@tutienda"
                error={errors['social.facebook']}
                onChange={(value) =>
                  patch(
                    {
                      social: {
                        ...theme.social,
                        facebook: value.trim() === '' ? null : value,
                      },
                    },
                    'facebook',
                  )
                }
              />
              <SwitchField
                label="Botón de WhatsApp"
                hint="Usa el número que guardaste en Tienda."
                checked={theme.social.whatsapp}
                onChange={(whatsapp) =>
                  patch({ social: { ...theme.social, whatsapp } })
                }
              />
            </div>

            <div className="border-border space-y-4 border-t pt-4">
              <p className="text-sm leading-none font-medium">Pie de página</p>
              <TextField
                label="Mensaje final"
                value={theme.footer.text ?? ''}
                maxLength={200}
                placeholder="Gracias por pedir en nuestra tienda"
                error={errors['footer.text']}
                onChange={(value) =>
                  patch(
                    {
                      footer: {
                        ...theme.footer,
                        text: value.trim() === '' ? null : value,
                      },
                    },
                    'footerText',
                  )
                }
              />
              <SwitchField
                label="Mostrar el mapa"
                checked={theme.footer.showMap}
                onChange={(showMap) =>
                  patch({ footer: { ...theme.footer, showMap } })
                }
              />
              <SwitchField
                label="Mostrar el horario"
                checked={theme.footer.showSchedule}
                onChange={(showSchedule) =>
                  patch({ footer: { ...theme.footer, showSchedule } })
                }
              />
            </div>
          </EditorSection>

          {/* --------------------------------------------------------- */}
          <EditorSection
            value="extras"
            title="Extras"
            summary="Animaciones y copias del tema"
            icon={SettingsIcon}
          >
            <SegmentedField
              label="Animaciones"
              value={theme.motion}
              options={choices(THEME_MOTIONS, THEME_MOTION_LABELS)}
              onChange={(motion) => patch({ motion })}
              hint="Si un cliente pidió reducir el movimiento, lo respetamos igual."
              columns={3}
            />

            <div className="space-y-2">
              <p className="text-sm leading-none font-medium">
                Guardar o reutilizar este tema
              </p>
              <ThemeIoControls
                theme={theme}
                storeName={storeName}
                onImport={(imported) => commit(imported)}
              />
              <p className="text-muted-foreground text-xs">
                «Duplicar» copia el tema al portapapeles; ábrelo en otra tienda
                y usa «Pegar».
              </p>
            </div>
          </EditorSection>

          {/* --------------------------------------------------------- */}
          <EditorSection
            value="css"
            title="CSS avanzado"
            summary="Solo si sabes lo que haces"
            icon={CodeIcon}
          >
            <TextAreaField
              label="CSS personalizado"
              value={theme.customCss ?? ''}
              maxLength={4096}
              rows={8}
              mono
              placeholder={'.store-title { letter-spacing: 0.02em }'}
              error={errors.customCss}
              hint="Limpiamos el CSS antes de publicarlo: solo declaraciones, siempre dentro de tu tienda. Las reglas @ y los enlaces externos se descartan."
              onChange={(value) =>
                patch(
                  { customCss: value.trim() === '' ? null : value },
                  'customCss',
                )
              }
            />
          </EditorSection>
        </EditorAccordion>

        <div className="border-border rounded-[var(--radius-lg)] border p-4">
          <AccessibilityPanel theme={theme} onChange={(next) => commit(next)} />
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Preview                                                            */}
      {/* ----------------------------------------------------------------- */}
      {desktop ? (
        <aside className="lg:sticky lg:top-20 lg:h-[calc(100dvh-7rem)]">
          {previewPane}
        </aside>
      ) : null}
    </div>
  )
}
