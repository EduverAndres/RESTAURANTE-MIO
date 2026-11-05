import type { PaymentMethod } from '@/types/app'

/**
 * One customer-facing sentence about how to pay, built from the gateways that
 * are actually switched on. Marketing copy that lists a method the checkout
 * does not offer is a promise the product breaks at the last step, so the
 * sentence is derived, never hand-written.
 *
 * The development mock is never named. When both gateways are on, Wompi's
 * wording wins because it is the wider one (it adds Nequi).
 */
export function describeHowToPay(methods: readonly PaymentMethod[]): string {
  const cash = methods.includes('cash')
  const online = methods.includes('wompi')
    ? 'con tarjeta, PSE o Nequi'
    : methods.includes('mercadopago')
      ? 'con tarjeta o PSE'
      : null

  if (cash && online)
    return `Pagas en efectivo al recibir o en línea ${online}.`
  if (cash) return 'Pagas en efectivo al recibir o al recoger tu pedido.'
  if (online) return `Pagas en línea ${online}.`
  return 'Pagas como acepte cada negocio.'
}
