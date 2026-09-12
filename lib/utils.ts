import { createCn } from 'cn/config'

/**
 * Class merger aware of the design-system utilities defined in
 * app/globals.css (documented in docs/DESIGN.md).
 *
 * Without these extensions tailwind-merge classifies any unknown `text-*` as a
 * colour and any unknown `p-*`/`gap-*` value as unrecognised, so
 * `cn('text-display', 'text-white')` silently dropped `text-display` and the
 * element rendered at body size. Registering the tokens puts them in the right
 * conflict groups: a fluid type utility now replaces (and is replaced by) other
 * font sizes, and the semantic spacing scale behaves like any spacing value.
 */
export const cn = createCn({
  extend: {
    theme: {
      // Semantic spacing scale: feeds every spacing group (p/px/m/gap/...).
      spacing: ['section', 'card', 'inline', 'gutter'],
    },
    classGroups: {
      'font-size': [
        'text-display',
        'text-h1',
        'text-h2',
        'text-h3',
        'text-lead',
      ],
    },
  },
})
