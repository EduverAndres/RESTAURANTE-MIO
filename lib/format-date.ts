// Shared date formatting for admin and dashboard tables. Pure module.

const dateCOFormatter = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** "12 sept 2026" style date in Colombian Spanish. */
export function formatDateCO(date: Date | string): string {
  return dateCOFormatter.format(typeof date === 'string' ? new Date(date) : date)
}
