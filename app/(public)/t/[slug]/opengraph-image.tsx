import { ImageResponse } from 'next/og'
import { fetchStore } from '@/lib/store/data'
import { buildPlaceholder, placeholderSvg } from '@/lib/store/placeholder'
import { normalizeTheme } from '@/lib/theme'

export const runtime = 'nodejs'
export const alt = 'Portada de la tienda'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * The card a link to this storefront turns into on WhatsApp, Instagram or
 * Slack. It is built from the same theme the page uses — brand colour, name,
 * logo — so a shared link already looks like the shop. Without a logo it falls
 * back to the very pattern the storefront draws for a missing image.
 */
export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const store = await fetchStore(slug)

  if (!store) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#fbf8f3',
            color: '#1c1917',
            fontSize: 56,
          }}
        >
          Tienda no encontrada
        </div>
      ),
      size,
    )
  }

  const theme = normalizeTheme(store.theme)
  const logo = theme.logoUrl ?? store.logo_url
  const pattern = buildPlaceholder(store.slug, theme.primary, store.name)
  const patternUri = `data:image/svg+xml;base64,${Buffer.from(
    placeholderSvg(pattern),
  ).toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: theme.background,
          color: theme.text,
          fontFamily: 'sans-serif',
        }}
      >
        {/* Brand wash, so the card reads as this shop at thumbnail size. */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 16,
            background: theme.primary,
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <div
            style={{
              display: 'flex',
              width: 132,
              height: 132,
              borderRadius: theme.imageShape === 'circle' ? 999 : 28,
              overflow: 'hidden',
              background: theme.surface,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori
                renders plain <img>; next/image is not available here. */}
            <img
              src={logo ?? patternUri}
              alt=""
              width={132}
              height={132}
              style={{ objectFit: 'cover' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {store.category ? (
              <div
                style={{
                  fontSize: 26,
                  letterSpacing: 4,
                  textTransform: 'uppercase',
                  color: theme.primary,
                }}
              >
                {store.category}
              </div>
            ) : null}
            {store.address ? (
              <div style={{ fontSize: 26, opacity: 0.55 }}>
                {store.address.slice(0, 48)}
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              fontSize: store.name.length > 24 ? 78 : 104,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -2,
            }}
          >
            {store.name}
          </div>
          {store.description ? (
            <div style={{ fontSize: 32, opacity: 0.7, lineHeight: 1.35 }}>
              {store.description.slice(0, 120)}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              display: 'flex',
              padding: '14px 28px',
              borderRadius: 999,
              background: theme.primary,
              color: theme.onPrimary,
              fontSize: 30,
              fontWeight: 600,
            }}
          >
            Pide en línea
          </div>
          {/* Satori needs every multi-child element to declare a display, so
              this stays a single interpolated string. */}
          <div style={{ fontSize: 28, opacity: 0.55 }}>
            {`${store.prep_time_min ?? 20} min · ${store.delivery_radius_km} km`}
          </div>
        </div>
      </div>
    ),
    size,
  )
}
