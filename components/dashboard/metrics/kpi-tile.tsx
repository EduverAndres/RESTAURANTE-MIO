interface KpiTileProps {
  label: string
  value: string
  hint?: string
}

export function KpiTile({ label, value, hint }: KpiTileProps) {
  return (
    <div className="rounded-card border-border bg-card shadow-soft border p-4">
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </dt>
      <dd className="font-display mt-1 text-2xl font-semibold tabular-nums">
        {value}
      </dd>
      {hint ? (
        <dd className="text-muted-foreground mt-0.5 text-xs">{hint}</dd>
      ) : null}
    </div>
  )
}
