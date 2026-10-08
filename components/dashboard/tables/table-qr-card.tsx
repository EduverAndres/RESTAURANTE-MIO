import { ExternalLinkIcon } from 'lucide-react'

interface TableQrCardProps {
  number: number
  url: string
  /** SVG markup produced server-side by lib/tables/server#renderQrSvg. */
  svg: string
  /** Client-side actions rendered under the code (dashboard list only). */
  actions?: React.ReactNode
}

/** One table with its QR code. Server component: the SVG is trusted output. */
export function TableQrCard({ number, url, svg, actions }: TableQrCardProps) {
  return (
    <article
      aria-label={`Mesa ${number}`}
      className="rounded-card border-border bg-card shadow-soft flex flex-col items-center gap-3 border p-4 text-center"
    >
      <div
        role="img"
        aria-label={`Código QR de la mesa ${number}`}
        className="size-36 [&_svg]:size-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="font-display text-2xl font-semibold">Mesa {number}</p>
      {/* Opens exactly what the printed code opens, so the merchant can check
          a table before a customer does. */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={url}
        className="text-muted-foreground hover:text-foreground inline-flex w-full items-center justify-center gap-1 text-xs underline-offset-4 hover:underline"
      >
        <span className="truncate">{url}</span>
        <ExternalLinkIcon aria-hidden="true" className="size-3 shrink-0" />
        <span className="sr-only">(abre la mesa en otra pestaña)</span>
      </a>
      {actions}
    </article>
  )
}
