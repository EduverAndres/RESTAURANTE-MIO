import type { MetadataRoute } from 'next'
import { APP_NAME } from '@/lib/env'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} · Pide a los negocios de tu barrio`,
    short_name: APP_NAME,
    description:
      'Pide a los restaurantes y negocios de Barranquilla: a domicilio, para recoger o desde la mesa.',
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
