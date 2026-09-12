import { highlightMatches } from '@/lib/store/search'

/**
 * Renders `text` with the part matching `query` marked. `<mark>` carries the
 * meaning natively, so a screen reader announces the hit without an aria hack.
 */
export function Highlight({ text, query }: { text: string; query: string }) {
  const segments = highlightMatches(text, query)
  if (segments.length === 1 && !segments[0].match) return <>{text}</>

  return (
    <>
      {segments.map((segment, index) =>
        segment.match ? (
          <mark
            key={index}
            className="rounded-sm bg-[rgb(var(--store-accent-rgb)/0.35)] px-0.5 text-[var(--store-text)]"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  )
}
