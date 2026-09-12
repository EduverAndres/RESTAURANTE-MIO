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

const nextConfig: NextConfig = {
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
