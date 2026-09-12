# Design system

All visual decisions live in `app/globals.css`. Components consume tokens; they
never hard-code a size, a shadow or a color. `tests/design-tokens.test.ts` reads
that stylesheet and measures it, so the palette cannot silently regress.

## Principles

1. **One source of truth.** A value that appears twice is a token.
2. **Fluid, not stepped.** Type and spacing interpolate with the viewport
   (`clamp()`), so there are no layout cliffs between breakpoints.
3. **Elevation over outlines.** Depth comes from light and shadow, tinted by the
   active brand color; borders are a last resort.
4. **Accessible by construction.** Every text/background pair in the palette is
   measured against WCAG AA (4.5:1) by a test, not by eye.
5. **Tenant themes are first class.** The `--store-*` contract lets a
   storefront restyle itself without any component knowing about it.

## Type scale

Sizes interpolate between a 360px and a 1280px viewport. `--text-body` never
drops below `1rem` and `--text-small` never below `14px`.

| Token            | Value                                              | Utility         |
| ---------------- | -------------------------------------------------- | --------------- |
| `--text-display` | `clamp(2rem, 1.0217rem + 4.3478vw, 4.5rem)`        | `.text-display` |
| `--text-h1`      | `clamp(1.75rem, 1.2609rem + 2.1739vw, 3rem)`       | `.text-h1`      |
| `--text-h2`      | `clamp(1.5rem, 1.2065rem + 1.3043vw, 2.25rem)`     | `.text-h2`      |
| `--text-h3`      | `clamp(1.25rem, 1.1033rem + 0.6522vw, 1.625rem)`   | `.text-h3`      |
| `--text-lead`    | `clamp(1.125rem, 1.0272rem + 0.4348vw, 1.375rem)`  | `.text-lead`    |
| `--text-body`    | `clamp(1rem, 0.9756rem + 0.1087vw, 1.0625rem)`     | body default    |
| `--text-small`   | `clamp(0.875rem, 0.8506rem + 0.1087vw, 0.9375rem)` | —               |

Tracking: `--tracking-display: -0.03em` (display and h1), `--tracking-tight:
-0.015em` (h2, h3 and the base heading rule).

The `.text-display` / `.text-h*` utilities set font size, line height, letter
spacing and `text-wrap: balance` together. `.text-lead` adds `text-wrap: pretty`
and `.text-pretty` applies it on its own.

## Spacing

| Token             | Value                                       | Tailwind key |
| ----------------- | ------------------------------------------- | ------------ |
| `--space-section` | `clamp(3rem, 1.4348rem + 6.9565vw, 7rem)`   | `*-section`  |
| `--space-card`    | `clamp(1rem, 0.8043rem + 0.8696vw, 1.5rem)` | `*-card`     |
| `--space-inline`  | `clamp(1rem, 0.6087rem + 1.7391vw, 2rem)`   | `*-inline`   |
| `--space-gutter`  | `clamp(1rem, 0.4783rem + 2.3188vw, 2rem)`   | `*-gutter`   |

They are exposed through `@theme inline` in the `--spacing-*` namespace, so
`py-section`, `gap-card`, `px-gutter` and friends work like any Tailwind
spacing utility. `container-page` uses `--space-gutter` for its side padding.

## Elevation

Shadows are tinted with `--elevation-tint`, which defaults to `var(--primary)`
and becomes `var(--store-primary)` inside `[data-store-theme]`. A tinted shadow
reads as light bouncing off a colored surface, so a card feels part of the brand
instead of a grey rectangle dropped onto it; a neutral hairline keeps the edge
crisp on low-contrast backgrounds.

| Token        | Tint  | Use                          |
| ------------ | ----- | ---------------------------- |
| `--shadow-1` | `8%`  | resting cards, chips         |
| `--shadow-2` | `12%` | hovered cards, floating bars |
| `--shadow-3` | `18%` | dialogs, sheets, popovers    |

Each is `ambient + tinted diffusion + 1px hairline`. `--shadow-soft` and
`--shadow-lift` are kept as aliases of `--shadow-1` / `--shadow-2` so existing
components are unaffected. Tailwind exposes `shadow-1`, `shadow-2`, `shadow-3`.
Dark mode only re-points `--shadow-hairline` and `--shadow-ambient`.

## Surfaces and glass

`--background` < `--surface` < `--card` / `--popover` < `--surface-elevated`
form one luminosity ramp; pick the next step up instead of adding a border.

`.surface-glass` is for sticky bars and overlays: a semi-transparent
`--surface`, `backdrop-filter: blur(14px) saturate(140%)` and a 1px border mixed
from `--border`. Browsers without `backdrop-filter` fall back to an opaque
`--card` through `@supports not (...)`.

## Focus

```css
:where(:focus-visible):not(:where([class*='focus-visible:ring'], ...)) {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
```

It sits **outside every cascade layer**. Unlayered declarations outrank layered
ones, so it beats Tailwind's `outline-none` / `outline-hidden` utilities without
editing the components that use them, and its zero specificity (`:where()`)
still lets an explicit rule win. Components that ship their own focus
affordance (`focus-visible:ring-*`, `focus-visible:border-*`,
`focus-visible:outline-*`) are exempted so nothing paints two rings.

Inside `[data-store-theme]` the ring follows the tenant: `--ring` is re-pointed
to `--store-primary`.

## Dark palette

Measured with `contrastRatio()` from `lib/color/contrast.ts`.

| Token                  | Hex       | Measured                                               |
| ---------------------- | --------- | ------------------------------------------------------ |
| `--background`         | `#0e0d0b` | base of the ramp                                       |
| `--surface`            | `#161412` | —                                                      |
| `--card` / `--popover` | `#1d1a17` | —                                                      |
| `--surface-elevated`   | `#242019` | —                                                      |
| `--foreground`         | `#f3efe8` | 16.95 bg · 16.03 surface · 15.11 card · 14.14 elevated |
| `--muted-foreground`   | `#a89f93` | 7.44 bg · 7.04 surface · 6.64 card · 6.21 elevated     |
| `--primary`            | `#f97316` | —                                                      |
| `--primary-foreground` | `#1c1917` | 6.24 on `--primary`                                    |
| `--accent`             | `#fbbf24` | —                                                      |
| `--accent-foreground`  | `#1c1917` | 10.48 on `--accent`                                    |
| `--destructive`        | `#f87171` | 6.32 with `--destructive-foreground`                   |
| `--success`            | `#4ade80` | 10.04 with `--success-foreground`                      |

Borders are derived, not hand-picked: `color-mix(in oklch, var(--foreground)
12%, transparent)` for `--border`, 18% for `--input`. Elevation is expressed by
luminosity; the border is only a hint.

Light palette for reference: `--foreground` 16.51 on `--background`,
`--muted-foreground` `#6b6259` 5.64 on `--background` and 5.97 on `--card`,
`--primary-foreground` 5.18 on `--primary`.

## Store utilities

### The `--store-*` contract

`lib/theme.ts#themeToCssVars` writes these as an inline style on the storefront
wrapper (`[data-store-theme]` in `app/(public)/t/[slug]/storefront.tsx`).
`app/globals.css` declares a default for each one, so the utilities render
correctly even outside a storefront.

| Variable                | Meaning                                 |
| ----------------------- | --------------------------------------- |
| `--store-primary`       | tenant brand color                      |
| `--store-on-primary`    | text on `--store-primary`               |
| `--store-secondary`     | quiet fill for secondary surfaces       |
| `--store-accent`        | highlight color                         |
| `--store-background`    | page background                         |
| `--store-surface`       | card background                         |
| `--store-text`          | body text                               |
| `--store-radius`        | card radius (`rounded-store`)           |
| `--store-button-radius` | control radius (`rounded-store-button`) |
| `--store-font-display`  | headings                                |
| `--store-font-body`     | body copy                               |
| `--store-*-rgb`         | channel triplets for `rgb(... / alpha)` |

`--store-on-primary` and `--store-secondary` are now driven by real theme
fields. The full list of variables the theme emits — gradient, pattern, heading
treatment, density, card style, image ratio and shape, motion — is in
[Store theme](#store-theme) below; `:root` declares a default for every one of
them.

### Classes

Every `.store-*` class derives **only** from `--store-*` tokens, so a tenant
theme fully controls them.

```jsx
<div className="store-card p-card">
  <span className="store-chip">Nuevo</span>
  <h3 className="store-text text-h3">Arepa de queso</h3>
  <p className="store-muted text-pretty">Maíz blanco, queso costeño.</p>
  <a className="store-link" href="/t/arepa-and-co/menu">
    Ver el menú
  </a>
  <div className="mt-card flex gap-2">
    <button className="store-btn px-4 py-2">Agregar</button>
    <button className="store-btn-outline px-4 py-2">Detalles</button>
  </div>
</div>
```

| Class                | What it does                                                                     |
| -------------------- | -------------------------------------------------------------------------------- |
| `.store-btn`         | solid `--store-primary` fill, `--store-on-primary` text, `--radius-store-button` |
| `.store-btn-outline` | transparent fill, tinted border and `--store-primary` text                       |
| `.store-chip`        | pill with a 14% `--store-primary` tint, `--text-small`                           |
| `.store-card`        | `--store-surface`, `--radius-store`, `--shadow-1`                                |
| `.store-text`        | `--store-text`                                                                   |
| `.store-muted`       | `--store-text` mixed 66% into `--store-surface`                                  |
| `.store-link`        | `--store-primary` with an offset underline that thickens on hover                |

They only set color, radius, elevation and type; padding and layout stay with
Tailwind utilities at the call site.

## App surfaces

Phase 6 brought the rest of the app up to the storefront's level. It added four
things to the stylesheet and nothing else; everything on those screens is built
from the tokens above.

| Addition                | What it is                                                                      |
| ----------------------- | ------------------------------------------------------------------------------- |
| `.rail`                 | Horizontal snap scroller: `flex`, `scroll-snap-type: x mandatory`, no scrollbar |
| `@keyframes check-draw` | The confirmation tick drawing itself along its own path                         |
| `--destructive-on-tint` | Alert ink dark enough to clear AA on an alert-tinted card                       |
| `--app-header-h`        | `4rem`; every sticky column in the app offsets from it                          |

**`.rail`** is the carousel-on-mobile, grid-on-desktop pattern: the same markup
is a flick-through row on a phone (`components/home/store-rail.tsx`) and a plain
grid from `lg` up, because a single column of tall cards makes people scroll
blind. Its children are links or buttons, so the scroll region is keyboard
reachable without a `tabindex` of its own.

**`check-draw`** animates `stroke-dashoffset` from `var(--check-length)` — set
inline by the component from the path length — to `0`. The reduced-motion policy
collapses it to 1ms, which leaves the tick _drawn_: the animation only ever
removes an offset, so nothing essential is hidden when motion is off.

**`--destructive-on-tint`** is the Phase-5 `--primary-on-tint` idea applied to
the alert hue. `text-destructive` on `bg-destructive/12`, over a card that is
itself 6% destructive, measures 4.42:1 — the Kanban's "Con retraso" badge. The
token is the same hue taken down until it clears 4.5:1; the dark ramp's
`--destructive` is already light enough and keeps the plain token.

### Time as colour

`lib/orders/elapsed-tone.ts` maps minutes-since-placed to `fresh` / `warn` /
`late`, with a budget per Kanban column (`pending` has the shortest fuse: three
minutes to amber, eight to red). In a kitchen nobody reads "hace 12 min" on
twenty cards; everybody sees that one card is red. The tone is never the only
cue — an amber or red card also carries the words _Va justo_ / _Con retraso_, so
the board still works in greyscale and under a high-contrast preference.

## Motion

| Token               | Value                            |
| ------------------- | -------------------------------- |
| `--duration-fast`   | `150ms` (hover, focus)           |
| `--duration-base`   | `220ms` (open/close)             |
| `--duration-slow`   | `300ms` (large surfaces)         |
| `--ease-out-soft`   | `cubic-bezier(0.2, 0.8, 0.2, 1)` |
| `--animate-fade-up` | entrance for content blocks      |

`--ease-out-soft` is also exposed as the Tailwind `ease-out-soft` utility.

**Reduced-motion policy.** A global, unlayered
`@media (prefers-reduced-motion: reduce)` block collapses every animation and
transition to `1ms` via `:where(*, *::before, *::after)` and forces
`scroll-behavior: auto`. Zero specificity means a component can still opt out
deliberately; unlayered placement means no Tailwind utility can accidentally
override it. Never gate essential feedback on an animation.

## Adding a token

1. Declare it in `:root` in `app/globals.css` (and override it in `.dark` only
   if the dark ramp needs a different value).
2. If it is a color pair that carries text, measure it with `contrastRatio()`
   and add the assertion to `tests/design-tokens.test.ts`. AA is 4.5:1.
3. Expose it through `@theme inline` when components should reach it as a
   Tailwind utility (`--color-*`, `--spacing-*`, `--radius-*`, `--shadow-*`,
   `--ease-*`, `--font-*`).
4. Add a `@utility` only when the token travels as a group (size + line height +
   tracking, or fill + radius + shadow).
5. Document it in the matching table above.
6. Run `npx vitest run tests/design-tokens.test.ts` and `npm run lint`.

## Store theme

### The contract

`stores.theme` is one JSON document that describes a tenant storefront end to
end. It is read through `lib/theme.ts#normalizeTheme` (still exported as
`mergeTheme` for existing callers), which fills every missing key from
`DEFAULT_STORE_THEME`, clamps numbers, drops unknown keys and never throws, so a
theme written by an older version of the editor keeps rendering.

The fields split in two:

- **Skin** — colour, gradient, pattern, typography treatment, density, card
  style, image ratio and shape, motion. `themeToCssVars` turns these into
  `--store-*` custom properties, so components style themselves from variables
  instead of receiving twenty props.
- **Structure** — `menuLayout`, `categoryNav`, `productHover`, `showPrices`,
  `sectionOrder` and the section content groups (`hero`, `featured`, `story`,
  `social`, `footer`, `badges`). Components read these from the object.

`mode` (`light` / `dark` / `auto`) resolves **inside `[data-store-theme]` only**.
It picks the storefront's own ramp and never fights the app's global theme
toggle.

`sectionOrder` always contains the four core sections (`hero`, `featured`,
`menu`, `info`); `story`, `reviews` and `social` are opt-in, so upgrading a
stored theme never grows a storefront a section it never had.

### Fields

| Field            | Type                                                                                            | Default                    | CSS variable                                               |
| ---------------- | ----------------------------------------------------------------------------------------------- | -------------------------- | ---------------------------------------------------------- |
| `mode`           | `light \| dark \| auto`                                                                         | `light`                    | — (scopes the ramp)                                        |
| `logoUrl`        | `string \| null`                                                                                | `null`                     | —                                                          |
| `primary`        | hex                                                                                             | `#C2410C`                  | `--store-primary`, `--store-primary-rgb`                   |
| `onPrimary`      | hex, **computed**                                                                               | `#FFFFFF`                  | `--store-on-primary`, `--store-on-primary-rgb`             |
| `secondary`      | hex                                                                                             | `#7C2D12`                  | `--store-secondary`, `--store-secondary-rgb`               |
| `accent`         | hex                                                                                             | `#F59E0B`                  | `--store-accent`, `--store-accent-rgb`                     |
| `background`     | hex                                                                                             | `#FBF8F3`                  | `--store-background`, `--store-background-rgb`             |
| `surface`        | hex                                                                                             | `#FFFFFF`                  | `--store-surface`, `--store-surface-rgb`                   |
| `text`           | hex                                                                                             | `#1C1917`                  | `--store-text`, `--store-text-rgb`                         |
| `gradient`       | `{ enabled, from, to, angle 0–360 }`                                                            | off, `135deg`              | `--store-gradient` (a ready `linear-gradient()` or `none`) |
| `pattern`        | `none \| dots \| grid \| noise \| diagonal \| waves`                                            | `none`                     | `--store-pattern-image`, `--store-pattern-size`            |
| `patternOpacity` | `0–0.2`                                                                                         | `0.06`                     | `--store-pattern-opacity`                                  |
| `fontDisplay`    | `ThemeFont`                                                                                     | `Fraunces`                 | `--store-font-display`                                     |
| `fontBody`       | `ThemeFont`                                                                                     | `Inter`                    | `--store-font-body`                                        |
| `headingWeight`  | `400 \| 500 \| 600 \| 700 \| 800`                                                               | `700`                      | `--store-heading-weight`                                   |
| `headingCase`    | `normal \| uppercase`                                                                           | `normal`                   | `--store-heading-case` (a `text-transform` value)          |
| `letterSpacing`  | `tight \| normal \| wide`                                                                       | `normal`                   | `--store-letter-spacing` (an em value)                     |
| `radius`         | `0–64` px                                                                                       | `20`                       | `--store-radius`                                           |
| `buttonStyle`    | `pill \| rounded \| square`                                                                     | `pill`                     | `--store-button-radius`                                    |
| `density`        | `compact \| comfortable \| spacious`                                                            | `comfortable`              | `--store-density-padding` / `-gap` / `-section`            |
| `cardStyle`      | `elevated \| flat \| outlined \| glass`                                                         | `elevated`                 | `--store-card-shadow`, `--store-card-border`               |
| `imageRatio`     | `1:1 \| 4:3 \| 3:2 \| 16:9`                                                                     | `4:3`                      | `--store-image-ratio` (an `aspect-ratio` value)            |
| `imageShape`     | `rounded \| squircle \| circle \| arch`                                                         | `rounded`                  | `--store-image-radius`                                     |
| `banner`         | `{ imageUrl, overlayOpacity 0–1, layout }`                                                      | `full`, `0.35`             | `--store-banner-overlay`                                   |
| `hero`           | `{ align, showLogo, logoSize, tagline, showRating, showEta, showSchedule, ctaLabel, videoUrl }` | left, md, badges on        | —                                                          |
| `menuLayout`     | `grid \| list \| magazine \| masonry`                                                           | `grid`                     | —                                                          |
| `categoryNav`    | `tabs \| chips \| sidebar \| sticky-bar`                                                        | `chips`                    | —                                                          |
| `productHover`   | `lift \| zoom \| reveal \| none`                                                                | `lift`                     | —                                                          |
| `showPrices`     | `always \| on-hover`                                                                            | `always`                   | —                                                          |
| `badges`         | `{ newDays 0–365, popularEnabled, style }`                                                      | `14`, on, `soft`           | —                                                          |
| `sectionOrder`   | `ThemeSection[]`                                                                                | hero, featured, menu, info | —                                                          |
| `featured`       | `{ title, productIds (≤12), layout }`                                                           | `Destacados`, carousel     | —                                                          |
| `story`          | `{ enabled, title, text ≤600, imageUrl }`                                                       | off                        | —                                                          |
| `social`         | `{ instagram, tiktok, facebook, whatsapp }`                                                     | all off                    | —                                                          |
| `footer`         | `{ text ≤200, showMap, showSchedule }`                                                          | map and schedule on        | —                                                          |
| `motion`         | `full \| subtle \| none`                                                                        | `full`                     | `--store-motion-duration`                                  |
| `customCss`      | `string \| null`, ≤4 KB                                                                         | `null`                     | — (injected, scoped)                                       |

`hero.videoUrl` is restricted to an `https:` URL ending in `.mp4`. The `social.*`
fields accept an `@handle` or a profile link, capped at 64 characters. Banner
layouts are `full`, `split`, `compact`, `editorial` and `video`.

### Readability policy

`ensureReadable(theme)` returns `{ theme, warnings }` and follows one rule:
**auto-fix only what cannot be wrong on purpose.**

| Pair                     | Behaviour                                                                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onPrimary` on `primary` | **Auto-fixed.** Below 4.5:1 it becomes whichever of `#ffffff` / `#1c1917` scores better, so a button is never illegible. The merchant never picks it. |
| `text` on `background`   | **Warning only.** The brand colour is never mutated.                                                                                                  |
| `text` on `surface`      | **Warning only.**                                                                                                                                     |
| `secondary` on `surface` | **Warning only.**                                                                                                                                     |

A `ThemeWarning` is `{ field, ratio, required, message }`; `field` names the
input the merchant should change and `message` is Spanish, for the editor. When
neither ink clears AA against `primary`, the auto-fix still picks the better of
the two and adds a warning on `primary` itself.

### `customCss` sanitisation

`sanitizeCustomCss(input)` is the only path merchant CSS takes into a page. In
order:

1. Input over **4096 UTF-8 bytes** is rejected outright (the editor caps it too,
   so an oversized value means the row was written around the form).
2. Comments are stripped first, so nothing can hide a payload inside one.
3. **Every at-rule is dropped**, prelude and body: no `@import`, no `@media`, no
   `@font-face`, no layer or container games.
4. Only declarations survive. A property must look like a property, and its
   value may not contain `expression()`, `javascript:`, `behavior:`,
   `-moz-binding`, `</`, a backslash escape, or a `url()` pointing anywhere other
   than a `data:` URI.
5. Every selector is prefixed with `[data-store-theme]`, and selectors touching
   `:root`, `html` or `body` are dropped, so nothing can restyle the app around
   the storefront. Bare declarations are wrapped in the scope.

It returns `null` when nothing survives, and is idempotent on its own output.

### Migration

`supabase/migrations/20260912000500_store_theme_v2.sql` sets the new column
default and back-fills existing rows, merging each nested group explicitly
because `||` is shallow. `tests/theme.test.ts` parses that file and asserts both
JSON literals still equal `DEFAULT_STORE_THEME`, so the column and the code
cannot drift apart.

---

## Editor

The merchant-facing theme editor lives at `/dashboard/settings`. It is a
Canva-style two-pane screen: an accordion of controls on the left, the live
storefront on the right. On a phone the right pane becomes a bottom sheet behind
a **Ver** button.

The whole editor is one `dynamic()` chunk
(`app/dashboard/settings/theme-form.tsx`) with `ssr: false`, so Pedidos, Menú
and the rest of the dashboard never load the presets, the OKLCH maths, the
cropper or the colour extractor.

### One object, one direction

There is no form library. The editor holds a single `StoreTheme` and every
control is a controlled input over it. Every mutation goes through one `commit`,
which runs `ensureReadable` (Phase 2), so `onPrimary` is recomputed on each edit
and a button can never end up illegible. Presets, imported files, palette
suggestions and accessibility fixes all do the same thing: hand back a new
theme.

Validation is `storeThemeSchema.safeParse` on every change, with the issues
mapped by dotted path so each field shows its own message. The server action is
untouched and validates again.

### Live preview

The preview is the **real storefront**: the same `Storefront` component, the
same sections, the same data, inside an iframe pointed at a dedicated route.

| Piece           | Where                                               |
| --------------- | --------------------------------------------------- |
| Preview route   | `app/(preview)/t/[slug]/preview/page.tsx`           |
| In-frame bridge | `app/(preview)/t/[slug]/preview/preview-bridge.tsx` |
| Editor side     | `components/dashboard/theme/preview-pane.tsx`       |
| Shared contract | `lib/theme/preview-message.ts`                      |

The route sits in its own `(preview)` group so it inherits no marketplace
chrome, and `[data-store-preview]` zeroes `--site-header-h` (see the editor
block at the end of `app/globals.css`) so the sticky stack does not reserve room
for a header that is not there.

**It is merchant-only.** The page resolves the signed-in user and loads the
store by `slug` _and_ `owner_id`; anyone else gets a 404. There is no
unauthenticated endpoint that accepts a theme. The draft itself is not trusted
either: it arrives in a cookie and goes straight through `normalizeTheme`, the
same gate the public storefront uses on the database column. The route is
`noindex`, and it writes nothing.

Updates travel on two channels, because a storefront is two things at once:

- **Skin** — every `--store-*` variable, the motion and scheme attributes and
  the merchant stylesheet. The editor `postMessage`s the theme (debounced
  120 ms) and the bridge writes the variables onto the wrapper. No request, no
  reload: typing a hex code moves the preview.
- **Structure** — which sections render, the menu layout, the hero variant, the
  copy. Those are server decisions, so the editor drops the theme into a
  per-store cookie (`previewCookieName(storeId)`, custom CSS stripped to stay
  inside the 4 KB cookie budget) and the bridge calls `router.refresh()`. The
  frame is not reloaded and the scroll position survives.

`structureSignature(theme)` is what separates the two: when it does not move,
the refresh is skipped entirely. After a refresh lands the bridge re-applies the
last message, because the server re-renders the wrapper from `theme.mode` and
would otherwise drop the toolbar's light/dark override.

The bridge applies nothing until the document has loaded. The storefront streams
its sections in, and writing to the wrapper while React is still hydrating a
boundary below it produces a mismatch. Waiting costs nothing: the server already
rendered whatever is in the cookie.

### Presets

`lib/theme/presets.ts` ships eight complete looks — **Elegante, Callejero,
Fresco, Nocturno, Cafetería, Mar, Minimal, Fiesta**. Each is a full, already
normalized `StoreTheme` that passes `storeThemeSchema` and scores 100 on
`auditTheme`; `tests/theme-presets.test.ts` asserts all three.

Thumbnails are drawn from each preset's own colours, fonts, radius and card
style — there is no image asset, so a new preset is one entry and nothing else.

`applyPreset(current, preset)` takes the look and keeps the content: logo,
cover, featured picks, story text, social handles, footer copy, tagline, CTA
label and custom CSS all survive, and a section the merchant had switched on is
appended to the preset's order rather than dropped.

### Smart palettes (OKLCH)

`lib/theme/oklch.ts` converts sRGB hex to OKLCH and back, and maps out-of-gamut
colours by binary-searching the chroma down along a constant hue, so a generated
colour keeps the hue and lightness that was asked for instead of clipping a
channel.

`lib/theme/palette.ts` builds three palettes around the merchant's primary —
complementary, analogous, monochromatic — each with its contrast ratios and a
pass/warn verdict against AA. Harmonies are computed in OKLCH because it is
perceptually uniform: rotating a hue keeps the apparent lightness, so a
suggestion never comes out with a washed-out yellow next to a heavy blue. Pure
and deterministic: the same primary always yields the same three palettes.

### Colours from the logo

`lib/theme/extract.ts` quantises an RGBA buffer into its dominant colours with
uniform 5-bit-per-channel bucketing: deterministic, allocation-light and
accurate enough for "which four colours is this logo made of?". Flat neutrals
are weighted down rather than dropped, so a black-and-white logo still gets an
answer while a white card behind a brand mark does not win by area.

The canvas half lives in `components/dashboard/theme/image-canvas.ts`.
Extraction runs on the file the merchant just cropped, so there is no CORS
problem at all; `extractColorsFromUrl` exists for an already-uploaded logo and
degrades to _"No pudimos leer los colores de esta imagen"_ when the canvas is
tainted.

### Images

`ImageField` crops before uploading. The crop box is already the aspect ratio
the chosen hero layout will render (`BANNER_CROP_ASPECT`), the merchant drags
and zooms inside it, and the canvas writes exactly what they framed. Upload
reuses the existing `uploadStoreAsset` server action — same bucket, same 3 MB
limit, same ownership check as the Tienda screen.

### Ordering

Section order and featured products both offer **two independent paths**: HTML5
drag and drop for a mouse, and subir / bajar buttons for a keyboard or a screen
reader. The buttons are not a fallback — the lists are fully usable without ever
starting a drag, which is why no drag-and-drop library is installed.

### Editor state

`lib/theme/history.ts` is a plain past/present/future triple: pure, generic and
tested without React. Consecutive edits of the same control inside 700 ms share
one entry, so undoing a typed tagline steps over the word rather than each
letter. Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z are wired up, Guardar is disabled when
nothing changed, and leaving with unsaved changes warns.

`lib/theme/io.ts` exports and imports the theme as JSON. Every inbound path — a
file or a pasted clipboard — runs `normalizeTheme` and then `storeThemeSchema`,
so a pasted file can make a storefront ugly but can never make it invalid and
can never smuggle anything into the page. **Duplicar** copies the theme to the
clipboard; **Pegar** reads it back in another store.

### Accessibility panel

`lib/theme/score.ts` runs five weighted checks and scores the theme out of 100,
with a one-click fix for each. The contrast maths is `contrastRatio` from Phase
2 — it is not re-implemented — so the panel and the storefront can never
disagree.

| Check                | Weight | Reads                                          | Fix                                                           |
| -------------------- | ------ | ---------------------------------------------- | ------------------------------------------------------------- |
| `text-background`    | 25     | `text` on `background`                         | Moves the ink's lightness in OKLCH until it clears 4.5:1      |
| `text-surface`       | 25     | `text` on `surface`                            | Same, against the cards                                       |
| `on-primary`         | 20     | better of near-white / near-black on `primary` | Moves `primary` the shortest distance that makes ink readable |
| `touch-target`       | 15     | `density`                                      | `compact` becomes `comfortable`                               |
| `heading-legibility` | 15     | `headingCase` + `letterSpacing`                | Uppercase on tight tracking becomes `normal`                  |

A pass earns its full weight, a warning half, a failure none. A fix is a no-op
when its check already passes, so **Arreglar todo** is idempotent.

The last two checks are not contrast. `touch-target` reads `density` because it
is the only lever in the theme that changes how tall a control ends up:
`compact` drives the padding to 0.75rem, which puts a standard button just under
the 44px comfortable target. `heading-legibility` stands in for a minimum font
size — the theme has no font-size field, since the storefront's type scale is
fixed in `globals.css`, so the legibility risk a merchant can actually create is
uppercase set on tight tracking.

The score sits in a polite live region, so a screen reader hears the new number
after a fix without being interrupted mid-sentence.
