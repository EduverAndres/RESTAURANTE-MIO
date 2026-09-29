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
 */
function contentSecurityPolicy(): string {
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
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    [
      'img-src',
      "'self'",
      'data:',
      'blob:',
      ...supabaseSources,
      'https://images.unsplash.com',
      'https://*.tile.openstreetmap.org',
    ].join(' '),
    "font-src 'self' data:",
    [
      'connect-src',
      "'self'",
      ...supabaseSources,
      ...supabaseRealtime,
      'https://nominatim.openstreetmap.org',
      'https://router.project-osrm.org',
      'https://api.openrouteservice.org',
      'https://*.tile.openstreetmap.org',
    ].join(' '),
    "frame-src 'self'",
    "frame-ancestors 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
}

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
  // Habilita la compilación ultra ligera para servidores con poca RAM (AWS Lightsail)
  output: 'standalone',

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
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
  allowedDevOrigins: ['192.168.56.1', '192.168.*.*', '10.*.*.*'],
  experimental: {
    serverActions: {
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