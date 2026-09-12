import { SectionShell } from '@/components/store/sections/section-shell'
import { StoreImage } from '@/components/store/store-image'
import type { StoreSectionProps } from '@/components/store/storefront-context'

/**
 * The merchant's own words. Two columns on a wide screen with the picture
 * second, so the text leads on a phone; paragraphs are split on blank lines so
 * a 600-character story does not arrive as one wall.
 */
export function StorySection({ context }: StoreSectionProps) {
  const { store, theme } = context
  const { story } = theme
  if (!story.enabled || !story.text.trim()) return null

  const paragraphs = story.text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  return (
    <SectionShell id="historia">
      <div className="gap-inline grid items-center lg:grid-cols-2">
        <div className="space-y-4">
          <h2 className="store-heading text-h2 text-[var(--store-text)]">
            {story.title}
          </h2>
          <div className="space-y-3 text-[rgb(var(--store-text-rgb)/0.75)]">
            {paragraphs.map((paragraph, index) => (
              <p key={index} className="text-pretty text-[var(--text-lead)]">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        {story.imageUrl ? (
          <div className="store-media shadow-2 aspect-[4/3] w-full">
            <StoreImage
              src={story.imageUrl}
              alt=""
              seed={`historia-${store.slug}`}
              color={theme.primary}
              label={store.name}
              sizes="(min-width: 1024px) 50vw, 100vw"
              initialScale={2}
            />
          </div>
        ) : null}
      </div>
    </SectionShell>
  )
}
