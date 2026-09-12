import { SectionShell } from '@/components/store/sections/section-shell'
import type { StoreSectionProps } from '@/components/store/storefront-context'

// Brand marks are drawn here rather than imported: the icon set ships no brand
// glyphs, and these inherit `currentColor` so they follow the tenant theme.
const GLYPH_PROPS = {
  viewBox: '0 0 24 24',
  'aria-hidden': true as const,
  focusable: 'false' as const,
  className: 'size-5',
}

function InstagramGlyph() {
  return (
    <svg {...GLYPH_PROPS} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function TiktokGlyph() {
  return (
    <svg {...GLYPH_PROPS} fill="currentColor">
      <path d="M16.5 3h-2.6v12.1a2.5 2.5 0 1 1-2-2.45V10a5.1 5.1 0 1 0 4.6 5.07V8.9a6.3 6.3 0 0 0 3.5 1.06V7.4a3.9 3.9 0 0 1-3.5-4.4Z" />
    </svg>
  )
}

function FacebookGlyph() {
  return (
    <svg {...GLYPH_PROPS} fill="currentColor">
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.87.25-1.46 1.5-1.46h1.6V4.46A21 21 0 0 0 14.3 4.3c-2.33 0-3.93 1.42-3.93 4.04v2.16H7.8v3h2.57V21h3.13Z" />
    </svg>
  )
}

function WhatsappGlyph() {
  return (
    <svg {...GLYPH_PROPS} fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15.07L2 22l5.06-1.33A10 10 0 1 0 12 2Zm0 2a8 8 0 1 1-4.13 14.85l-.3-.18-2.63.69.7-2.56-.19-.31A8 8 0 0 1 12 4Zm-3.1 4.3c-.16 0-.42.06-.64.3-.22.24-.85.83-.85 2.02s.87 2.34.99 2.5c.12.16 1.7 2.7 4.2 3.68 2.08.82 2.5.66 2.95.62.45-.04 1.45-.59 1.65-1.17.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28-.24-.12-1.45-.72-1.67-.8-.23-.08-.39-.12-.55.12-.16.24-.63.8-.77.96-.14.16-.28.18-.52.06-.24-.12-1.03-.38-1.96-1.21-.72-.65-1.21-1.45-1.35-1.69-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.33-.75-1.82-.2-.47-.4-.41-.55-.42h-.47Z" />
    </svg>
  )
}

/** `@handle` or a full URL — the merchant may store either. */
function profileUrl(base: string, handle: string): string {
  const value = handle.trim()
  if (/^https?:\/\//i.test(value)) return value
  return `${base}${value.replace(/^@/, '')}`
}

/** Digits only: what wa.me expects. */
function whatsappUrl(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}`
}

/**
 * Icon links to wherever the shop actually lives. Rendered only when there is
 * at least one — `resolveSections` drops the whole band otherwise.
 */
export function SocialSection({ context }: StoreSectionProps) {
  const { store, theme } = context
  const { social } = theme

  const links = [
    social.instagram
      ? {
          key: 'instagram',
          label: 'Instagram',
          href: profileUrl('https://instagram.com/', social.instagram),
          icon: <InstagramGlyph />,
        }
      : null,
    social.tiktok
      ? {
          key: 'tiktok',
          label: 'TikTok',
          href: profileUrl('https://tiktok.com/@', social.tiktok),
          icon: <TiktokGlyph />,
        }
      : null,
    social.facebook
      ? {
          key: 'facebook',
          label: 'Facebook',
          href: profileUrl('https://facebook.com/', social.facebook),
          icon: <FacebookGlyph />,
        }
      : null,
    social.whatsapp && store.whatsapp_phone
      ? {
          key: 'whatsapp',
          label: 'WhatsApp',
          href: whatsappUrl(store.whatsapp_phone),
          icon: <WhatsappGlyph />,
        }
      : null,
  ].filter((link) => link !== null)

  if (links.length === 0) return null

  return (
    <SectionShell id="redes" title="Síguenos">
      <ul className="flex flex-wrap gap-3">
        {links.map((link) => (
          <li key={link.key}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="store-btn-outline h-12 gap-2 px-5"
            >
              {link.icon}
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </SectionShell>
  )
}
