import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { PreviewBridge } from './preview-bridge'
import { Storefront } from '@/app/(public)/t/[slug]/storefront'
import { createClient } from '@/lib/supabase/server'
import { normalizeTheme } from '@/lib/theme'
import {
  decodePreviewTheme,
  previewCookieName,
  structureSignature,
} from '@/lib/theme/preview-message'
import type { Store } from '@/types/app'

/**
 * The live preview the theme editor renders inside an iframe.
 *
 * Two properties make this safe to exist at all:
 *
 * 1. **It is merchant-only.** The page resolves the signed-in user and loads
 *    the store by `slug` *and* `owner_id`. A visitor, or an owner poking at
 *    somebody else's slug, gets a 404 — there is no unauthenticated endpoint
 *    here that accepts a theme.
 * 2. **The draft is never trusted.** The in-progress theme arrives in a
 *    per-store cookie and goes straight through `normalizeTheme`, the same
 *    gate the public storefront uses on the database column, so a hand-written
 *    cookie can only produce a valid theme.
 *
 * Nothing on this page writes to the database.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Vista previa',
  robots: { index: false, follow: false },
}

interface PreviewPageProps {
  params: Promise<{ slug: string }>
}

export default async function ThemePreviewPage({ params }: PreviewPageProps) {
  const { slug } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: store } = await supabase
    .from('stores')
    .select('*')
    .eq('slug', slug)
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!store) notFound()

  const jar = await cookies()
  const draft = decodePreviewTheme(jar.get(previewCookieName(store.id))?.value)
  const theme = normalizeTheme(draft ?? store.theme)

  return (
    // `data-store-preview` drops the marketplace header from the sticky stack
    // (see the editor block in globals.css): this frame has no chrome above.
    <div data-store-preview>
      <PreviewBridge signature={structureSignature(theme)} />
      {/* `stores.theme` is a Json column; the draft is already a valid theme. */}
      <Storefront
        store={{ ...store, theme: theme as unknown as Store['theme'] }}
      />
    </div>
  )
}
