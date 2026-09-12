import type { MetadataRoute } from 'next'
import { APP_NAME } from '@/lib/env'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} · Pide a tu restaurante favorito`,
    short_name: APP_NAME,
    description:
      'Pide a domicilio, recoge en el local o desde la mesa, en un solo lugar.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FBF8F3',
    theme_color: '#C2410C',
    lang: 'es-CO',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
