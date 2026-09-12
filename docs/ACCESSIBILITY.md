# Accesibilidad

> Este documento está en español porque describe decisiones de producto que el
> equipo entero consulta. El código, los identificadores y los comentarios
> siguen en inglés, como en el resto del repositorio.

## La política

**WCAG 2.1 nivel AA**, en toda la aplicación: tienda pública, checkout, panel
del comercio, panel de administración, repartidor y modo mesa.

Tres compromisos concretos por encima del mínimo:

1. **Nada depende del color solo.** Estado, error y selección siempre traen
   texto, icono o forma además del tono.
2. **Todo se opera con teclado.** Incluida la operación diaria del comercio: el
   tablero de pedidos se maneja sin ratón.
3. **El cliente puede ajustar la interfaz.** Tamaño de texto, contraste alto y
   animaciones reducidas son una preferencia guardada, no un detalle del
   sistema operativo.

## Qué se automatiza y qué no

### Automático (falla el build)

`@axe-core/playwright` corre **dentro de los recorridos e2e existentes**, no en
una suite aparte. Así cada pantalla se audita en el estado en el que la
encuentra una persona real —con el carrito lleno, el diálogo abierto, el error
visible— y una regresión rompe la misma prueba que cubre la funcionalidad.

El helper es `e2e/axe.ts`:

```ts
await expectNoA11yViolations(page, 'storefront · cart sheet')
```

- Etiquetas WCAG auditadas: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`.
- **Falla con `critical` o `serious`.** `moderate` y `minor` se reportan en el
  log pero no bloquean: son mayoritariamente heurísticas de estructura que
  generan ruido y empujan a silenciar reglas, que es lo contrario de lo que
  queremos.
- El mensaje de error nombra la pantalla, la regla, el HTML del nodo y los
  colores medidos, para que se pueda arreglar sin abrir el trace.

Puntos auditados hoy:

| Pantalla                                        | Spec                          |
| ----------------------------------------------- | ----------------------------- |
| Portada del marketplace                         | `e2e/storefront.spec.ts`      |
| Portada con texto extra grande + contraste alto | `e2e/storefront.spec.ts`      |
| Tienda · menú                                   | `e2e/storefront.spec.ts`      |
| Tienda · cajón de producto                      | `e2e/storefront.spec.ts`      |
| Tienda · carrito                                | `e2e/storefront.spec.ts`      |
| Checkout                                        | `e2e/checkout.spec.ts`        |
| Login                                           | `e2e/checkout.spec.ts`        |
| Panel del comercio · tablero                    | `e2e/merchant-kanban.spec.ts` |
| Administración · tiendas                        | `e2e/admin.spec.ts`           |
| Tienda en mesa                                  | `e2e/table-order.spec.ts`     |
| Tienda en mesa al 200 %                         | `e2e/table-order.spec.ts`     |
| Checkout en mesa                                | `e2e/table-order.spec.ts`     |

**Reglas desactivadas: ninguna.** El helper acepta
`disableRules: ['regla']` por llamada, pero hoy no hay ni una sola excepción en
el repositorio. Si algún día hace falta una, va con un comentario que explique
por qué en ese punto exacto —nunca global— y se añade a esta lista.

### Manual (no lo ve axe)

axe detecta alrededor de un tercio de los problemas reales. Lo siguiente se
revisa a mano antes de publicar una pantalla nueva:

- **Orden de foco**: recorrer la página entera con `Tab` y comprobar que sigue
  el orden visual y que nada queda inalcanzable.
- **Lectura con lector de pantalla**: NVDA o VoiceOver sobre el recorrido
  completo, no solo elemento por elemento.
- **Sentido de las etiquetas**: «Agregar Arepa de queso al carrito» dice algo;
  «Botón» no. Esto axe no lo puede juzgar.
- **Zoom al 200 %** y ancho de 320 px: sin scroll horizontal, sin texto
  cortado.
- **Movimiento**: que `prefers-reduced-motion` y la preferencia en la app
  detengan de verdad lo que se mueve.
- **Contraste sobre imagen**: los textos sobre fotos de héroe, que axe no puede
  medir.

## Cómo correr la auditoría en local

```bash
# El servidor de desarrollo tiene que estar arriba en el puerto 3000.
npm run dev

# Toda la suite, con axe incluido.
npx playwright test

# Solo una pantalla.
npx playwright test e2e/storefront.spec.ts
```

Las cuentas sembradas están en `e2e/fixtures.ts` (`supabase/seed.sql` es la
fuente de verdad).

Si una prueba falla por contraste, el mensaje trae los dos colores y la razón
medida; casi siempre la respuesta es un token, no un valor suelto —ver
`--primary-on-tint` más abajo.

## Preferencias de accesibilidad del cliente

Tres ajustes, guardados en `localStorage` bajo `tienda-preferences` (la misma
clave que las preferencias de pago, en `stores/preferences.store.ts`).

| Preferencia         | Valores                       | Atributo en `<html>`                  |
| ------------------- | ----------------------------- | ------------------------------------- |
| Tamaño del texto    | `normal` · `large` · `xlarge` | `data-text-size="large"` / `"xlarge"` |
| Contraste alto      | activado / desactivado        | `data-contrast="high"`                |
| Reducir animaciones | activado / desactivado        | `data-motion="reduce"`                |

Un valor por defecto **no deja atributo**: el CSS solo describe las
excepciones.

### Cómo llegan al DOM

1. Un script mínimo en `<head>` (`accessibilityPreferencesScript()`, en
   `lib/a11y/preferences.ts`) lee `localStorage` y escribe los atributos
   **antes del primer pintado**. Quien eligió texto extra grande nunca ve un
   fotograma en tamaño normal.
2. Ya en el cliente, `<AccessibilityAttributes />` mantiene los atributos al
   día cuando la persona cambia una preferencia.

El script solo escribe atributos `data-*`. **next-themes** es el dueño del
atributo `class` en ese mismo elemento; los dos conviven sin tocarse.

### Qué hace cada uno, en CSS

- **Tamaño de texto** mueve una sola palanca: el `font-size` de la raíz (112,5 %
  y 125 %). Toda la escala fluida de la fase 1 está en `clamp()` con topes en
  `rem`, así que sube con ella; y también la escala de espaciado de Tailwind,
  que es lo que mantiene la proporción en vez de meter letras más grandes en
  cajas del mismo tamaño.
- **Contraste alto** no solo oscurece el texto: **fuerza bordes visibles**.
  Botones, enlaces, campos, tarjetas y menús reciben un borde sólido de
  `currentColor`, los enlaces se subrayan y el anillo de foco se engrosa a 3 px.
  La regla va fuera de toda capa de cascada, igual que la regla de foco de la
  fase 1, para ganarle a las utilidades (`border-0`, `shadow-none`) que el
  diseño normal usa para que los controles floten.
- **Reducir animaciones** replica el bloque global de `prefers-reduced-motion`,
  pseudo-elementos incluidos, para quien tiene una cosa configurada en el
  sistema y otra aquí.

### Dónde se cambian

El menú (`components/a11y/accessibility-menu.tsx`) está en dos sitios:

- la cabecera del sitio (`components/layout/site-header.tsx`), y
- la barra inferior en móvil (`components/layout/mobile-nav.tsx`),

porque quien necesita texto más grande en el teléfono no debería tener que
encontrar una cabecera de escritorio para conseguirlo.

La prueba «the accessibility preferences reshape the page and survive a
reload» (`e2e/storefront.spec.ts`) comprueba lo que de verdad importa: que el
tamaño de raíz sube de verdad, que el contraste alto dibuja un borde real —no
solo texto más oscuro—, que las tres preferencias sobreviven a una recarga, y
que la combinación más exigente sigue pasando la auditoría.

## Modo mesa (QR)

`/t/[slug]/mesa/[token]` y su checkout empiezan grandes: alguien lee esto con
el brazo estirado, con una mano, en un teléfono que probablemente no es suyo y
en un salón con poca luz.

- Texto base 17 px en lugar de 16 px.
- Acciones principales de **56 px** de alto (el objetivo AAA de 2.5.5, no el
  mínimo AA de 44 px). Se marcan a mano con `data-table-primary`, para que
  restilizar `.store-btn` no pueda encoger un objetivo sin querer.
- `overflow-x: clip` en la carcasa: un comensal no descubre un control que se
  fue de lado, y al 200 % el riesgo es real.
- El atributo `data-table-mode` vive en la carcasa de la tienda (render del
  servidor, por eso el primer pintado ya sale grande) **y** se refleja en
  `<html>` desde `TableContextSetter`, porque el carrito y el cajón de producto
  se portalizan a `document.body`, fuera de ese subárbol.

## Inventario de regiones en vivo

Regla: **una sola región por cosa que cambia**. Dos regiones anunciando el
mismo cambio es peor que ninguna.

| Componente                                           | Anuncia                                                  | Nota                                                                                                                                                                                                             |
| ---------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/dashboard/orders/order-board.tsx`        | Movimientos de pedidos en el tablero                     | Una región para todo el tablero. Botón, menú de la tarjeta y atajos pasan por `movedAnnouncement()`, y el eco de realtime usa la misma frase, para que un movimiento no se lea dos veces con palabras distintas. |
| `components/store/status-chips.tsx`                  | Abierto / cerrado de la tienda                           | Dueña única de ese dato en la página.                                                                                                                                                                            |
| `components/store/quantity-stepper.tsx`              | Cantidad de un producto                                  | Una por instancia; las instancias dentro del carrito o del cajón quedan en un subárbol `aria-hidden` mientras el modal está abierto, así que no se duplican.                                                     |
| `components/a11y/accessibility-menu.tsx`             | Estado de las tres preferencias                          | Una frase para el menú entero, no una por control.                                                                                                                                                               |
| `components/dashboard/theme/accessibility-panel.tsx` | Puntaje de accesibilidad del tema                        |                                                                                                                                                                                                                  |
| `components/dashboard/theme/theme-editor.tsx`        | Guardado / sin guardar                                   | Cambia dos veces por sesión de edición, no por pulsación.                                                                                                                                                        |
| `components/courier/courier-order-live.tsx`          | Estado del pedido para el repartidor                     |                                                                                                                                                                                                                  |
| `components/orders/delivery-map.tsx`                 | Asignación del domiciliario                              | Solo la frase de asignación. La distancia se reescribe en cada ping de GPS y antes se leía en voz alta cada pocos segundos.                                                                                      |
| `components/dashboard/store/store-basics-fields.tsx` | Disponibilidad de la dirección web                       |                                                                                                                                                                                                                  |
| Sonner (`components/ui/sonner.tsx`)                  | Cambios de estado del pedido en la página de seguimiento | El toaster es la región que anuncia; la tarjeta grande de `order-tracker.tsx` es contenido visible, no región en vivo, para no decir lo mismo dos veces.                                                         |

Eliminadas en la fase 5:

- `components/store/sections/info-section.tsx` — repetía la misma cadena
  `hours.label` que el chip del héroe.
- `app/(protected)/orders/[id]/review-form.tsx` — el nombre accesible de cada
  estrella ya termina en esa palabra («4 estrellas: Muy bueno»).
- `app/(protected)/orders/[id]/order-tracker.tsx` — duplicaba el toast.

## Formularios

- **Etiqueta visible siempre**, con `htmlFor`. Un `placeholder` no es una
  etiqueta: desaparece justo cuando la persona escribe.
- Cuando un grupo tiene un encabezado visible, ese encabezado **es** su nombre
  (`aria-labelledby`), no un `aria-label` con otras palabras: si no coinciden,
  quien usa control por voz no puede nombrar lo que ve (WCAG 2.5.3).
- Los errores llevan `role="alert"` y el campo apunta a ellos con
  `aria-describedby`, **solo cuando existen**. El fallo recurrente en este
  repositorio no era un error que faltaba, sino uno que se pintaba y al que
  nadie apuntaba: el lector decía «inválido» y se callaba.

Los tres ayudantes de `lib/a11y/forms.ts` hacen que la conexión sea una línea:

```tsx
;<Input
  id={id}
  aria-invalid={Boolean(error)}
  aria-describedby={describedBy(
    Boolean(hint) && hintId(id),
    Boolean(error) && errorId(id),
  )}
/>
{
  hint ? <p id={hintId(id)}>{hint}</p> : null
}
;<FieldError id={errorId(id)} message={error} />
```

## Teclado en el tablero del comercio

- Cada tarjeta es **una parada de tabulación** (`tabIndex={0}`), no una por
  botón: se llega a la tarjeta y se actúa desde ahí.
- Menú de acciones (`components/dashboard/orders/order-card-menu.tsx`) con las
  transiciones legales que devuelve `lib/orders/status.ts`. El menú no puede
  ofrecer un movimiento que el servidor rechazaría.
- Atajos con la tarjeta enfocada: **`A`** aceptar, **`L`** marcar listo. Se
  anuncian en `aria-keyshortcuts` y en un texto visible sobre el tablero.
- Los atajos se enlazan al `onKeyDown` **de la tarjeta**, nunca a `document`:
  quien escribe «arepa» en un buscador dos paneles más allá no puede aceptar un
  pedido sin querer. `isTypingTarget()` es la segunda barrera, y una tecla
  modificadora significa que la pulsación es del navegador.
- Ningún atajo llega a una acción destructiva, y cancelar sigue pidiendo
  confirmación venga de donde venga.

## Foco en capas superpuestas

Radix y vaul ya atrapan el foco, cierran con `Escape` y lo devuelven al
disparador. Se comprobó, no se reimplementó:

| Capa                                                                                                                              | Base                 | Resultado                  |
| --------------------------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------------- |
| Cajón de producto                                                                                                                 | vaul                 | Correcto sin cambios       |
| Carrito                                                                                                                           | Radix Dialog         | **Fuga arreglada** (abajo) |
| Diálogo de dirección, diálogo de categoría, hoja de producto, confirmaciones, navegación móvil del panel, vista previa del editor | Radix Dialog / Sheet | Correctos sin cambios      |

Todos los contenedores tienen título accesible (`DialogTitle` / `SheetTitle` /
`DrawerTitle`); se verificó uno por uno.

**La fuga**: el carrito no tiene `SheetTrigger` —su estado vive en el store y
lo abren tres controles distintos—, así que Radix no tenía a quién devolver el
foco y caía en `<body>`, dejando a quien usa teclado al principio del documento
cada vez que cerraba el carrito. Lo resuelve
`components/a11y/use-return-focus.ts`. Cualquier capa que se abra desde un
store, y no desde un `Trigger`, necesita lo mismo.

## Color

El patrón que falló una y otra vez es texto de marca sobre un fondo teñido con
esa misma marca: `text-primary` sobre `bg-primary/10` mide 4,48:1 en modo
claro, justo por debajo del 4,5:1 que AA pide. Por eso existen
`--primary-on-tint` y `--success-on-tint`: el mismo tono, bajado lo justo para
pasar. En modo oscuro la rampa ya cumple y se quedan como están.

**Úsalos siempre que el texto de marca se apoye en un tinte de marca.**

El texto atenuado de la tienda (`rgb(var(--store-text-rgb)/α)`) necesita
**α ≥ 0,72** en tamaños de 14 px o menos.

`ensureReadable()` se aplica ahora también al renderizar la tienda, no solo en
el editor: recalcula únicamente `onPrimary` —la tinta sobre el color del
comercio, que el comercio nunca elige— para que una marca clara reciba texto
oscuro en lugar de blanco al 3:1. Los colores del comercio no se tocan.

## Lista de comprobación para una pantalla nueva

1. ¿Hay un `<h1>` y los encabezados bajan sin saltarse niveles?
2. ¿El contenido está dentro de un landmark (`main`, `nav`, `section`
   etiquetada)?
3. ¿Cada campo tiene etiqueta visible, y cada error `role="alert"` +
   `aria-describedby`?
4. ¿Cada botón de solo icono tiene `aria-label`, y **lo conserva mientras
   carga**? (Cambiar el texto por un spinner deja el botón sin nombre.)
5. ¿Cada icono decorativo lleva `aria-hidden="true"`?
6. ¿Las imágenes de producto llevan `alt` con el nombre, y las decorativas
   `alt=""`?
7. ¿Se recorre entera con `Tab`, en el orden visual, sin trampas?
8. ¿`Escape` cierra toda capa superpuesta y el foco vuelve al disparador?
9. ¿Lo que cambia solo se anuncia una vez? Revisa el inventario de arriba antes
   de añadir una región.
10. ¿Aguanta 200 % de zoom y 320 px de ancho sin scroll horizontal?
11. ¿Se ve bien con `data-contrast="high"` y con `data-text-size="xlarge"`?
12. ¿Añadiste `expectNoA11yViolations()` al recorrido e2e que la cubre?
