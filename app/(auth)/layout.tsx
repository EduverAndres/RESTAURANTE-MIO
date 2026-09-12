import { Wordmark } from '@/components/layout/site-header'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { APP_NAME } from '@/lib/env'

function DecorativePattern() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 400"
      className="text-primary/15 pointer-events-none absolute inset-0 size-full"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern
          id="auth-dots"
          width="28"
          height="28"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="2" cy="2" r="1.5" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="400" height="400" fill="url(#auth-dots)" />
      <circle cx="320" cy="90" r="120" fill="var(--primary)" opacity="0.08" />
      <circle cx="70" cy="330" r="90" fill="var(--accent)" opacity="0.12" />
      <path
        d="M40 200c60-80 160-80 220 0s160 80 220 0"
        stroke="var(--primary)"
        strokeWidth="2"
        fill="none"
        opacity="0.25"
      />
    </svg>
  )
}

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="bg-secondary/60 relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        <DecorativePattern />
        <div className="relative">
          <Wordmark className="text-3xl" />
        </div>
        <div className="relative max-w-lg space-y-5">
          <h2 className="font-display font-display-soft text-5xl leading-[1.02] font-semibold tracking-tight xl:text-6xl">
            Tu comida favorita,
            <br />
            <span className="text-primary">a dos toques</span> de distancia.
          </h2>
          <p className="text-muted-foreground text-lg">
            Guarda tu dirección y tu método de pago una vez. Después, pedir en{' '}
            {APP_NAME} toma menos de un minuto.
          </p>
        </div>
        <p className="text-muted-foreground relative text-sm">
          Restaurantes independientes, con identidad propia.
        </p>
      </aside>

      <div className="flex flex-col">
        <header className="flex h-16 items-center justify-between px-5 sm:px-8">
          <Wordmark className="lg:invisible" />
          <ThemeToggle />
        </header>
        <main className="flex flex-1 items-center justify-center px-5 pb-16 sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  )
}
