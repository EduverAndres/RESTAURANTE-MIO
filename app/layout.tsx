import type { Metadata, Viewport } from 'next'
import {
  DM_Sans,
  Fraunces,
  Geist,
  Instrument_Serif,
  Inter,
  Playfair_Display,
  Space_Grotesk,
} from 'next/font/google'
import { AccessibilityAttributes } from '@/components/a11y/accessibility-attributes'
import { RealtimeProvider } from '@/components/providers/realtime-provider'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { ServiceWorkerRegister } from '@/components/pwa/sw-register'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { accessibilityPreferencesScript } from '@/lib/a11y/preferences'
import { APP_NAME, env } from '@/lib/env'
import './globals.css'

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  display: 'swap',
  axes: ['opsz', 'SOFT'],
})

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
})

// The remaining theme faces are only reached when a merchant picks them, so
// they are declared but not preloaded: the browser fetches a file only when a
// storefront actually renders text in that family.
const instrumentSerif = Instrument_Serif({
  variable: '--font-instrument-serif',
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  preload: false,
})

const playfairDisplay = Playfair_Display({
  variable: '--font-playfair-display',
  subsets: ['latin'],
  display: 'swap',
  preload: false,
})

const geist = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
  display: 'swap',
  preload: false,
})

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  display: 'swap',
  preload: false,
})

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  display: 'swap',
  preload: false,
})

const THEME_FONT_VARIABLES = [
  fraunces.variable,
  inter.variable,
  instrumentSerif.variable,
  playfairDisplay.variable,
  geist.variable,
  dmSans.variable,
  spaceGrotesk.variable,
].join(' ')

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: {
    default: `${APP_NAME} · Pide a tu restaurante favorito`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    'Pide a domicilio, recoge en el local o desde la mesa. Cada restaurante con su propia identidad, en una sola plataforma.',
  applicationName: APP_NAME,
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FBF8F3' },
    { media: '(prefers-color-scheme: dark)', color: '#0E0D0B' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${THEME_FONT_VARIABLES}`}
    >
      <head>
        {/*
          Stamps data-text-size / data-contrast / data-motion on <html> before
          first paint, so a customer who chose extra-large text or high
          contrast never sees a frame of the default. It writes data-*
          attributes only; next-themes owns `class` on the same element.
        */}
        {/* Fixed, self-contained source; no user input reaches it. */}
        <script
          dangerouslySetInnerHTML={{ __html: accessibilityPreferencesScript() }}
        />
      </head>
      <body className="font-sans">
        <AccessibilityAttributes />
        <ThemeProvider>
          {/*
            Realtime consumers live under (protected), /dashboard, /courier and
            the public storefront, so the root layout is the narrowest shell
            that covers them all. It is a client boundary that only passes
            `children` through: the pages below stay server components.
          */}
          <RealtimeProvider>
            <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          </RealtimeProvider>
          <Toaster />
          <InstallPrompt />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  )
}
