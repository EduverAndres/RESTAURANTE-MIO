/**
 * The empty-state drawings, one family: a 160×120 line drawing on a dashed
 * table line, strokes in the muted ink, one filled shape in the brand colour
 * and one accent detail. No people's faces, no local clichés: what makes
 * them ours is the awning and the dot from the logo.
 *
 * All colours are tokens, so the dark ramp and a store's own theme apply.
 */

export type EmptyIllustrationName =
  'plate' | 'bag' | 'rider' | 'awning' | 'table'

const BASE = {
  viewBox: '0 0 160 120',
  'aria-hidden': true,
  className: 'text-muted-foreground/60 h-28 w-auto',
  fill: 'none',
} as const

function TableLine() {
  return (
    <path
      d="M14 104h132"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeDasharray="4 6"
    />
  )
}

/** A paper order bag with a receipt: no orders yet, an empty cart. */
function Bag() {
  return (
    <svg {...BASE}>
      <TableLine />
      <ellipse
        cx="80"
        cy="102"
        rx="36"
        ry="4"
        fill="currentColor"
        opacity="0.12"
      />
      <path
        d="M100 38h18v28l-3-2-3 2-3-2-3 2-3-2-3 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M104 45h10M104 51h10M104 57h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path d="M56 50h48l6 50H50Z" fill="var(--primary)" opacity="0.9" />
      <path
        d="M68 50c0-15 24-15 24 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle
        cx="80"
        cy="76"
        r="6"
        fill="var(--primary-foreground)"
        opacity="0.9"
      />
    </svg>
  )
}

/** A courier on a scooter with the delivery box: nothing to deliver yet. */
function Rider() {
  return (
    <svg {...BASE}>
      <TableLine />
      <path
        d="M16 70h14M12 80h12M18 90h8"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="50" cy="92" r="11" stroke="currentColor" strokeWidth="2" />
      <circle cx="114" cy="92" r="11" stroke="currentColor" strokeWidth="2" />
      <path
        d="M50 92h24l14-22h16l10 22"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M104 70l-6-16M93 54h11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect
        x="38"
        y="54"
        width="26"
        height="22"
        rx="3"
        fill="var(--primary)"
        opacity="0.9"
      />
      <circle
        cx="51"
        cy="65"
        r="3.5"
        fill="var(--primary-foreground)"
        opacity="0.9"
      />
      <circle cx="84" cy="38" r="7" stroke="currentColor" strokeWidth="2" />
      <path
        d="M84 45l-4 17 12 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** A shopfront under the logo's awning: no businesses here yet. */
function Awning() {
  return (
    <svg {...BASE}>
      <TableLine />
      <rect
        x="40"
        y="42"
        width="80"
        height="62"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M34 28h92v14a11.5 11.5 0 0 1-23 0a11.5 11.5 0 0 1-23 0a11.5 11.5 0 0 1-23 0a11.5 11.5 0 0 1-23 0Z"
        fill="var(--primary)"
        opacity="0.9"
      />
      <rect
        x="48"
        y="64"
        width="16"
        height="16"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.6"
      />
      <rect
        x="96"
        y="64"
        width="16"
        height="16"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.6"
      />
      <rect
        x="70"
        y="70"
        width="20"
        height="34"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="86" cy="88" r="1.5" fill="currentColor" />
      <circle cx="80" cy="60" r="3" fill="var(--accent)" />
    </svg>
  )
}

/** A table with its QR stand and a coffee: no tables set up yet. */
function Table() {
  return (
    <svg {...BASE}>
      <TableLine />
      <path
        d="M28 70h104"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M42 70v34M118 70v34"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect
        x="62"
        y="32"
        width="30"
        height="38"
        rx="3"
        stroke="currentColor"
        strokeWidth="2"
      />
      <g fill="var(--primary)">
        <rect x="67" y="37" width="8" height="8" />
        <rect x="79" y="37" width="8" height="8" />
        <rect x="67" y="49" width="8" height="8" />
        <rect x="80" y="50" width="3" height="3" />
        <rect x="84" y="54" width="3" height="3" />
        <rect x="79" y="58" width="3" height="3" />
        <rect x="67" y="61" width="20" height="3" opacity="0.5" />
      </g>
      <path
        d="M102 54h14v9a7 7 0 0 1-14 0Z"
        fill="var(--accent)"
        opacity="0.9"
      />
      <path
        d="M116 57h3a3 3 0 0 1 0 6h-3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M106 48c-2-3 2-5 0-8M112 48c-2-3 2-5 0-8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  )
}

/** The original: a plate and a steaming bowl. */
function Plate() {
  return (
    <svg {...BASE}>
      <TableLine />
      <ellipse
        cx="80"
        cy="82"
        rx="54"
        ry="14"
        fill="currentColor"
        opacity="0.12"
      />
      <ellipse
        cx="80"
        cy="78"
        rx="54"
        ry="14"
        stroke="currentColor"
        strokeWidth="2"
      />
      <ellipse
        cx="80"
        cy="78"
        rx="36"
        ry="9"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.5"
      />
      <path
        d="M46 46c0 20 15 32 34 32s34-12 34-32H46Z"
        fill="var(--primary)"
        opacity="0.9"
      />
      <path
        d="M52 46c4 10 14 18 28 18s24-8 28-18"
        stroke="var(--primary-foreground)"
        strokeWidth="1.5"
        opacity="0.35"
        strokeLinecap="round"
      />
      <path
        d="M66 34c-3-5 3-8 0-13M80 30c-3-5 3-8 0-13M94 34c-3-5 3-8 0-13"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M22 40v40M18 40v12a4 4 0 0 0 8 0V40"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M138 40v40M138 40c-6 4-6 16 0 20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

const DRAWINGS: Record<EmptyIllustrationName, () => React.JSX.Element> = {
  plate: Plate,
  bag: Bag,
  rider: Rider,
  awning: Awning,
  table: Table,
}

export function EmptyIllustration({ name }: { name: EmptyIllustrationName }) {
  const Drawing = DRAWINGS[name]
  return <Drawing />
}
