import {
  HowItWorksTabs,
  type HowItWorksFlow,
} from '@/components/home/how-it-works-tabs'
import { listPaymentOptions } from '@/lib/payments'
import { describeHowToPay } from '@/lib/payments/summary'

/**
 * How ordering works, and how booking works, as two tabs over the same
 * three steps.
 *
 * The payment step is built here, on the server, from the gateways that are
 * switched on, so the home never names a method the checkout does not offer.
 * The booking flow is the one the product implements: the restaurant
 * confirms, and nothing is paid up front.
 */
export function HowItWorks() {
  const flows: HowItWorksFlow[] = [
    {
      value: 'pedir',
      label: 'Pedir',
      note: 'Sin descargar nada. Y si estás en el negocio, escanea el QR de tu mesa y pide sin crear cuenta.',
      steps: [
        {
          title: 'Elige un negocio',
          text: 'Restaurantes y negocios de tu zona, con el tiempo estimado de entrega antes de pedir.',
        },
        {
          title: 'Pide y paga como prefieras',
          text: `${describeHowToPay(listPaymentOptions().map((option) => option.method))} El precio es el de la carta.`,
        },
        {
          title: 'Síguelo en vivo',
          text: 'Ves cada paso, del fogón a tu puerta, y lo recibes con un código que solo tú tienes.',
        },
      ],
      action: { href: '/#restaurantes', label: 'Pedir ahora' },
    },
    {
      value: 'reservar',
      label: 'Reservar',
      note: 'En los restaurantes que tienen reservas activas. No pagas nada por adelantado.',
      steps: [
        {
          title: 'Elige día, hora y personas',
          text: 'Ves las horas que el restaurante tiene libres y apartas la tuya.',
        },
        {
          title: 'El restaurante confirma',
          text: 'Te avisamos en cuanto acepte tu reserva, y la ves en tu cuenta.',
        },
        {
          title: 'Llega y disfruta',
          text: 'Tu reserva queda guardada con su código, por si te lo piden.',
        },
      ],
      action: { href: '/reservas', label: 'Reservar mesa' },
    },
  ]

  return (
    <section
      id="como-funciona"
      aria-labelledby="como-funciona-title"
      className="border-border/60 bg-secondary/40 scroll-mt-24 border-t"
    >
      <div className="container-page py-section space-y-8">
        <div className="reveal max-w-2xl space-y-3">
          <p className="text-primary-on-tint text-xs font-semibold tracking-wide uppercase">
            Así de fácil
          </p>
          <h2
            id="como-funciona-title"
            className="text-h1 font-display font-semibold"
          >
            Cómo funciona
          </h2>
        </div>

        <HowItWorksTabs flows={flows} />
      </div>
    </section>
  )
}
