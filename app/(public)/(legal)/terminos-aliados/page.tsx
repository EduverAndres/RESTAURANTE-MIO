import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalDocument } from '@/components/legal/legal-document'
import { COMPANY } from '@/lib/legal/company'

export const metadata: Metadata = {
  title: 'Términos para Comercios y Repartidores',
  description: `Condiciones para vender o entregar a través de ${COMPANY.brand}.`,
}

const B = COMPANY.brand

export default function PartnerTermsPage() {
  return (
    <LegalDocument
      documentKey="aliados"
      title="Términos para Comercios y Repartidores"
      intro={
        <p>
          Estos términos se suman a los{' '}
          <Link href="/terminos">Términos y Condiciones</Link> generales y
          aplican a quien se registra en {B} para vender (el «Comercio») o para
          hacer entregas (el «Repartidor»). Al crear tu cuenta de comercio o de
          repartidor, o al seguir usándola, los aceptas.
        </p>
      }
      sections={[
        {
          id: 'comercio-requisitos',
          title: 'Comercios: requisitos para vender',
          content: (
            <>
              <p>El Comercio declara y garantiza que:</p>
              <ul>
                <li>
                  Existe legalmente y está habilitado para su actividad: RUT,
                  registro en la Cámara de Comercio cuando aplique, y los
                  permisos, conceptos sanitarios y licencias que exija su
                  actividad (por ejemplo, el concepto sanitario para alimentos o
                  la habilitación de droguerías y farmacias).
                </li>
                <li>
                  La información que suministra (identificación, dirección,
                  contacto, datos bancarios) es veraz y la mantendrá
                  actualizada. {B} la verificará antes de publicar la tienda y
                  la entregará al consumidor que la solicite (art. 53, Ley
                  1480).
                </li>
                <li>
                  Solo ofrecerá productos lícitos, que puede vender y cuya
                  publicidad es veraz.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: 'comercio-responsabilidad',
          title: 'Comercios: responsabilidad por los productos',
          content: (
            <>
              <p>
                El Comercio es el <strong>vendedor y productor</strong> frente
                al consumidor y responde, de forma exclusiva, por:
              </p>
              <ul>
                <li>
                  La calidad, idoneidad, seguridad, inocuidad, cantidad, precio
                  e información de sus productos, incluidos ingredientes,
                  alérgenos y advertencias.
                </li>
                <li>
                  La garantía legal, cambios, devoluciones y reembolsos que le
                  correspondan según la Ley 1480 de 2011.
                </li>
                <li>
                  La expedición de la factura electrónica de venta y el
                  cumplimiento de sus obligaciones tributarias.
                </li>
                <li>
                  El cumplimiento de las normas de venta restringida (alcohol y
                  tabaco solo a mayores de edad, medicamentos bajo fórmula
                  médica cuando la requieran).
                </li>
              </ul>
            </>
          ),
        },
        {
          id: 'comercio-indemnidad',
          title: 'Comercios: indemnidad',
          content: (
            <p>
              El Comercio mantendrá indemne a {COMPANY.legalName}, sus
              administradores y empleados frente a cualquier reclamación,
              sanción, multa, condena o gasto (incluidos honorarios de abogados)
              que se derive de sus productos, de la información que publica, del
              incumplimiento de normas sanitarias, tributarias o de consumo, o
              del uso indebido de los datos de los Clientes, y asumirá la
              defensa correspondiente cuando así se le solicite.
            </p>
          ),
        },
        {
          id: 'comercio-datos',
          title: 'Comercios: datos de los Clientes',
          content: (
            <>
              <p>
                Para cumplir cada pedido, el Comercio recibe el nombre,
                teléfono, dirección y notas del Cliente. Se obliga a:
              </p>
              <ul>
                <li>
                  Usarlos <strong>exclusivamente</strong> para preparar,
                  entregar y atender ese pedido y sus reclamaciones.
                </li>
                <li>
                  No enviar publicidad ni contactar al Cliente con otros fines
                  sin su autorización previa, expresa y verificable.
                </li>
                <li>
                  Protegerlos con medidas de seguridad adecuadas y cumplir la
                  Ley 1581 de 2012.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: 'comercio-condiciones',
          title: 'Comercios: tarifas, pagos y contenido',
          content: (
            <>
              <ul>
                <li>
                  Las tarifas del servicio son las del plan que el Comercio
                  acepte al registrarse o las que se le informen en su panel,
                  con al menos treinta (30) días de anticipación a cualquier
                  cambio.
                </li>
                <li>
                  Los pagos de los Clientes se procesan por las pasarelas
                  habilitadas; los tiempos y costos de dispersión dependen de
                  ellas y del plan contratado.
                </li>
                <li>
                  El Comercio conserva la propiedad de su marca, logos, fotos y
                  carta, y concede a {B} una licencia gratuita, no exclusiva y
                  vigente mientras use la Plataforma para mostrarlos y
                  promocionar su tienda dentro y fuera de ella.
                </li>
                <li>
                  El Comercio no puede eliminar ni condicionar las reseñas
                  legítimas de los Clientes.
                </li>
                <li>
                  {B} puede suspender o retirar una tienda que incumpla estos
                  términos, acumule reclamaciones fundadas o ponga en riesgo a
                  los consumidores, informando el motivo.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: 'repartidor-relacion',
          title: 'Repartidores: naturaleza de la relación',
          content: (
            <>
              <p>
                El Repartidor presta sus servicios de forma{' '}
                <strong>independiente y autónoma</strong>, con sus propios
                medios. Decide libremente cuándo conectarse y qué entregas
                acepta o rechaza, sin horario ni exclusividad. Estos términos no
                crean una relación laboral, de agencia ni de sociedad entre el
                Repartidor y {COMPANY.legalName} o los Comercios.
              </p>
            </>
          ),
        },
        {
          id: 'repartidor-obligaciones',
          title: 'Repartidores: obligaciones',
          content: (
            <ul>
              <li>
                Contar con licencia de conducción vigente, SOAT, revisión
                técnico-mecánica y demás requisitos legales de su vehículo, y
                cumplir las normas de tránsito.
              </li>
              <li>
                Estar afiliado y cotizar a la seguridad social como trabajador
                independiente, conforme a la ley.
              </li>
              <li>
                Transportar los pedidos con higiene y cuidado, sin abrirlos ni
                alterarlos.
              </li>
              <li>
                Solicitar el <strong>código de entrega</strong> cuando el pedido
                lo tenga, y verificar la mayoría de edad de quien recibe bebidas
                alcohólicas o tabaco; si no la acredita, no entregar.
              </li>
              <li>
                Tratar con respeto a Clientes y Comercios, y usar sus datos solo
                para completar la entrega.
              </li>
            </ul>
          ),
        },
        {
          id: 'repartidor-ubicacion',
          title: 'Repartidores: ubicación',
          content: (
            <p>
              Mientras tiene una entrega activa, la Plataforma registra la
              ubicación de su dispositivo para mostrar el avance al Cliente y al
              Comercio. Fuera de una entrega activa no se hace seguimiento.
              Detalles en la{' '}
              <Link href="/privacidad">
                Política de Tratamiento de Datos Personales
              </Link>
              .
            </p>
          ),
        },
        {
          id: 'terminacion',
          title: 'Terminación',
          content: (
            <p>
              Comercios y Repartidores pueden dejar de usar la Plataforma en
              cualquier momento. {B} puede suspender o terminar el acceso por
              incumplimiento de estos términos, fraude o riesgo para usuarios,
              sin perjuicio de las obligaciones pendientes (pedidos en curso,
              garantías, pagos y reclamaciones).
            </p>
          ),
        },
      ]}
    />
  )
}
