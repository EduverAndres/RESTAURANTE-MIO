import { BrandMark } from '@/components/layout/brand-mark'
import { cn } from '@/lib/utils'

/**
 * A table's QR code with the platform mark in its centre.
 *
 * The mark covers about 20% of the side (4% of the area), well inside what
 * error correction H recovers (`renderQrSvg`). It sits on a white plate so
 * its edge never merges with a dark module. The SVG is trusted server output.
 */
export function QrWithMark({
  svg,
  label,
  className,
}: {
  /** SVG markup produced by lib/tables/server#renderQrSvg. */
  svg: string
  label: string
  className?: string
}) {
  return (
    <div role="img" aria-label={label} className={cn('relative', className)}>
      <div
        aria-hidden="true"
        className="size-full [&_svg]:size-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <span
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 grid size-[22%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[22%] bg-white p-[3%]"
      >
        <BrandMark className="size-full" />
      </span>
    </div>
  )
}
