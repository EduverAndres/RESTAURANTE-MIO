import type { NextConfig } from 'next'

function supabaseHostname(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return null
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

const supabaseHost = supabaseHostname()

/**
 * Content-Security-Policy, shipped **report-only and never enforcing**.
 *
 * Every source below is something the app really loads today, but the list is
 * not provably complete: Leaflet injects styles at runtime, per-store theming
 * writes inline `style` attributes, and a merchant can paste custom CSS. An
 * enforcing policy that is 99% right still breaks a storefront in production,
 * so this header exists to collect violations, not to block them. Promote it
 * to `Content-Security-Policy` only after a reporting period with no
 * legitimate violations.
 */
function contentSecurityPolicy(): string {
  // The project ref changes per environment, so the wildcard covers hosted
  // Supabase; the concrete host is added when it is known at build time.
  const supabaseSources = [
    'https://*.supabase.co',
    ...(supabaseHost ? [`https://${supabaseHost}`] : []),
  ]
  const supabaseRealtime = [
    'wss://*.supabase.co',
    ...(supabaseHost ? [`wss://${supabaseHost}`] : []),
  ]

  return [
    "default-src 'self'",
    // Next.js inlines its bootstrap and hydration payload, and the dev server
    // needs eval for React Refresh.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    // Per-store theme variables are written as inline styles on the storefront
    // wrapper, Leaflet ships its own injected styles, and merchants can save
    // sanitised custom CSS. Nonces cannot cover the attribute case.
    "style-src 'self' 'unsafe-inline'",
    [
      'img-src',
      "'self'",
      'data:', // inline SVG placeholders and generated table QR codes
      'blob:', // client-side previews of an image being uploaded
      ...supabaseSources, // product and branding images in Supabase Storage
      'https://images.unsplash.com', // seeded placeholder photography
      'https://*.tile.openstreetmap.org', // Leaflet raster tiles
    ].join(' '),
    // next/font/google self-hosts its faces at build time, so no font CDN.
    "font-src 'self' data:",
    // No Wompi origin belongs here. `fetchWompiTransaction` is the only thing
    // that calls the gateway API, and `lib/payments/wompi/provider.ts` is
    // `import 'server-only'`: the lookup happens in a Server Component and on
    // the webhook route, never in the browser, so `connect-src` has no say in
    // it.
    [
      'connect-src',
      "'self'",
      ...supabaseSources, // REST, Auth and Storage
      ...supabaseRealtime, // order and store realtime channels
      'https://nominatim.openstreetmap.org', // address search and geocoding
      'https://router.project-osrm.org', // courier route geometry
      'https://api.openrouteservice.org', // courier route geometry fallback
      'https://*.tile.openstreetmap.org', // Leaflet prefetches tiles via fetch
    ].join(' '),
    // The theme editor previews the storefront in a same-origin iframe; the
    // Wompi checkout is a top-level navigation, not a frame, so it needs no
    // entry here.
    "frame-src 'self'",
    "frame-ancestors 'self'",
    // The push service worker is registered from our own origin.
    "worker-src 'self'",
    "manifest-src 'self'",
    "base-uri 'self'",
    // Safe to keep at 'self' even though checkout leaves for Wompi: the
    // handoff is `window.location.assign(redirectUrl)`, a top-level
    // navigation, not a form submission, so `form-action` never sees it.
    // (Navigations as such would be `navigate-to`, which was dropped from
    // CSP3 and is implemented by no browser — nothing here constrains them.)
    "form-action 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
}

/**
 * `geolocation` stays enabled on our own origin: the address picker, the
 * courier board and the delivery ETA all read it (see "Testing on a phone" in
 * the README). `camera` is denied — nothing in the app scans a QR code, table
 * QR images are rendered server-side with the `qrcode` package — and so is
 * everything else we do not use.
 */
const PERMISSIONS_POLICY = [
  'geolocation=(self)',
  'camera=()',
  'microphone=()',
  'payment=()',
  'usb=()',
  'magnetometer=()',
  'accelerometer=()',
  'gyroscope=()',
  'interest-cohort=()',
].join(', ')

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            // Two years, so the origin is eligible for the preload list.
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Legacy companion to `frame-ancestors 'self'`, for browsers that
          // still honour it; the theme editor frames the storefront itself.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: PERMISSIONS_POLICY },
          {
            key: 'Content-Security-Policy-Report-Only',
            value: contentSecurityPolicy(),
          },
        ],
      },
    ]
  },
  // Allow the dev server to be opened from other devices on the local network.
  allowedDevOrigins: ['192.168.56.1', '192.168.*.*', '10.*.*.*'],
  experimental: {
    serverActions: {
      // Image uploads go through server actions; MAX_IMAGE_BYTES is 3 MB,
      // so leave headroom for the multipart envelope.
      bodySizeLimit: '4mb',
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      ...(supabaseHost
        ? [
            {
              protocol: 'https' as const,
              hostname: supabaseHost,
              pathname: '/storage/v1/object/public/**',
            },
          ]
        : []),
    ],
  },
}

export default nextConfig
