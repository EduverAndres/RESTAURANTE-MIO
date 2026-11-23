// Shared date formatting for admin and dashboard tables. Pure module.

const dateCOFormatter = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** "12 sept 2026" style date in Colombian Spanish. */
export function formatDateCO(date: Date | string): string {
  return dateCOFormatter.format(
    typeof date === 'string' ? new Date(date) : date,
  )
}

const timeCOFormatter = new Intl.DateTimeFormat('es-CO', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Bogota',
})

/**
 * "01:05 p. m." in Bogotá time, identical on the server and in the browser.
 *
 * Node's ICU separates "p." and "m." with a no-break space (U+00A0) and
 * Chrome's with a plain one: rendering the raw output in a client component
 * made the server HTML and the first client render disagree, and React threw
 * the tree away (a hydration error on the courier's pool).
 */
export function formatTimeCO(date: Date | string): string {
  return normalizeIcuSpaces(
    timeCOFormatter.format(typeof date === 'string' ? new Date(date) : date),
  )
}

/** Replaces the no-break spaces some ICU builds emit with plain ones. */
export function normalizeIcuSpaces(text: string): string {
  return text.replace(/[  ]/g, ' ')
}
