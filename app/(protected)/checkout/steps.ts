// The shape of the checkout flow, shared by the form, the progress bar and
// the step panels. Pure data: no React, no state.

export type Step = 'entrega' | 'pago' | 'resumen'

export const STEPS: readonly { id: Step; label: string }[] = [
  { id: 'entrega', label: 'Entrega' },
  { id: 'pago', label: 'Pago' },
  { id: 'resumen', label: 'Resumen' },
]

export type DeliveryType = 'delivery' | 'pickup'
export type Schedule = 'asap' | 'scheduled'

/**
 * The next quarter of an hour at least `offsetMinutes` from now, formatted
 * for `<input type="datetime-local">` (which wants local time, no zone).
 */
export function nextQuarterHour(
  offsetMinutes: number,
  now = new Date(),
): string {
  const date = new Date(now.getTime() + offsetMinutes * 60_000)
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
