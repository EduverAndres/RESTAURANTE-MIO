import type { Metadata } from 'next'
import { LegalDocument } from '@/components/legal/legal-document'
import { COMPANY } from '@/lib/legal/company'

export const metadata: Metadata = {
  title: 'Protección al Consumidor',
  description: `Retracto, reversión del pago, garantías y cómo reclamar en ${COMPANY.brand}.`,
}

const B = COMPANY.brand

export default function ConsumerProtectionPage() {
  return (
    <LegalDocument
      documentKey="consumidor"
      title="Política de Protección al Consumidor"
      intro={
        <p>
          Esta política resume tus derechos como consumidor en {B} según la Ley
          1480 de 2011 (Estatuto del Consumidor) y el Decreto 1074 de 2015, y te
          dice exactamente qué hacer si algo sale mal con un pedido.
        </p>
      }
      sections={[
        {
          id: 'quien-responde',
          title: 'Quién responde por cada pedido',
          content: (
            <>
              <p>
                El producto lo vende y prepara el Comercio. Por eso, la{' '}
                <strong>
                  garantía, calidad, idoneidad y seguridad del producto
                </strong>{' '}
                son responsabilidad del Comercio (art. 10, Ley 1480). {B}, como
                portal de contacto, te ayuda a gestionar la reclamación y te
                entrega la información de identificación del Comercio si la
                necesitas (art. 53, Ley 1480).
              </p>
            </>
          ),
        },
        {
          id: 'cancelacion',
          title: 'Cancelación antes de la preparación',
          content: (
            <p>
              Puedes cancelar tu pedido sin costo mientras el Comercio no lo
              haya aceptado, desde el detalle del pedido. Si ya pagaste, te
              devolvemos el valor completo por el mismo medio de pago.
            </p>
          ),
        },
        {
          id: 'retracto',
          title: 'Derecho de retracto',
          content: (
            <>
              <p>
                En las ventas a distancia puedes retractarte dentro de los{' '}
                <strong>cinco (5) días hábiles</strong> siguientes a la entrega
                (art. 47, Ley 1480), devolviendo el producto en las mismas
                condiciones en que lo recibiste. Los costos de transporte de la
                devolución corren por tu cuenta.
              </p>
              <p>
                La misma ley <strong>excluye del retracto</strong>, entre otros:
                los bienes perecederos, los que por su naturaleza no pueden
                devolverse o se deterioran o caducan con rapidez, los bienes de
                uso personal y los confeccionados según tus especificaciones.
                Por eso{' '}
                <strong>
                  las comidas preparadas, alimentos perecederos y medicamentos
                  no admiten retracto
                </strong>
                , aunque sí la garantía si llegan en mal estado.
              </p>
            </>
          ),
        },
        {
          id: 'reversion',
          title: 'Reversión del pago',
          content: (
            <>
              <p>
                Si pagaste con tarjeta de crédito, débito u otro instrumento
                electrónico, puedes pedir la reversión del pago (art. 51, Ley
                1480) cuando:
              </p>
              <ul>
                <li>Fuiste víctima de fraude.</li>
                <li>La operación no fue solicitada por ti.</li>
                <li>El producto no fue recibido.</li>
                <li>
                  El producto no corresponde a lo que pediste o está defectuoso.
                </li>
              </ul>
              <p>
                Debes presentar la solicitud dentro de los{' '}
                <strong>cinco (5) días hábiles</strong> siguientes a la fecha en
                que tuviste noticia de la situación, ante nosotros (al correo{' '}
                {COMPANY.email}) y ante el emisor de tu medio de pago. Cuando
                corresponda, deberás devolver el producto.
              </p>
            </>
          ),
        },
        {
          id: 'garantia',
          title: 'Garantía legal',
          content: (
            <>
              <p>
                Todo producto debe llegar en las condiciones de calidad,
                idoneidad y seguridad ofrecidas (art. 7, Ley 1480). Si tu pedido
                llega incompleto, equivocado, en mal estado o no apto para el
                consumo:
              </p>
              <ol>
                <li>
                  Repórtalo apenas lo recibas, idealmente con fotos y el número
                  del pedido, a {COMPANY.email}.
                </li>
                <li>
                  Trasladamos tu caso al Comercio, que debe responder según la
                  ley: reponer el producto, rehacerlo o devolverte el dinero.
                </li>
                <li>
                  Si el Comercio no responde, te acompañamos en la reclamación y
                  te entregamos sus datos de identificación.
                </li>
              </ol>
            </>
          ),
        },
        {
          id: 'reclamos',
          title: 'Peticiones, quejas y reclamos (PQR)',
          content: (
            <>
              <p>
                Escríbenos a <strong>{COMPANY.email}</strong> o al teléfono{' '}
                {COMPANY.phone} con tu nombre, el número de pedido y la
                descripción del problema. Te responderemos dentro de los{' '}
                <strong>quince (15) días hábiles</strong> siguientes.
              </p>
              <p>
                Si no quedas satisfecho, puedes presentar tu queja ante la{' '}
                <a
                  href="https://www.sic.gov.co"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Superintendencia de Industria y Comercio (SIC)
                </a>
                , autoridad de protección al consumidor en Colombia, o usar la
                plataforma{' '}
                <a
                  href="https://sicfacilita.sic.gov.co"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  SIC Facilita
                </a>
                .
              </p>
            </>
          ),
        },
        {
          id: 'informacion',
          title: 'Información clara antes de pagar',
          content: (
            <p>
              Antes de confirmar un pedido verás el precio total en pesos
              colombianos, el costo de envío, la propina (siempre voluntaria),
              el tiempo estimado y el medio de pago. Recibirás la confirmación
              del pedido y podrás seguir su estado en la Plataforma.
            </p>
          ),
        },
      ]}
    />
  )
}
