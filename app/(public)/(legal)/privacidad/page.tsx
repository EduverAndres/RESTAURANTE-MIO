import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalDocument } from '@/components/legal/legal-document'
import { COMPANY } from '@/lib/legal/company'
import { LEGAL_UPDATED_AT } from '@/lib/legal/consent'

export const metadata: Metadata = {
  title: 'Política de Tratamiento de Datos Personales',
  description: `Cómo ${COMPANY.brand} trata tus datos personales conforme a la Ley 1581 de 2012 y cómo ejercer tus derechos.`,
}

const B = COMPANY.brand

export default function PrivacyPage() {
  return (
    <LegalDocument
      documentKey="privacidad"
      title="Política de Tratamiento de Datos Personales"
      intro={
        <p>
          En {B} protegemos tus datos personales. Esta Política explica qué
          datos tratamos, para qué, con quién los compartimos y cómo puedes
          ejercer tus derechos, en cumplimiento de la Ley Estatutaria 1581 de
          2012, el Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015) y
          demás normas que los modifiquen o complementen.
        </p>
      }
      sections={[
        {
          id: 'responsable',
          title: 'Responsable del tratamiento',
          content: (
            <ul>
              <li>
                <strong>Razón social:</strong> {COMPANY.legalName}
              </li>
              <li>
                <strong>NIT:</strong> {COMPANY.nit}
              </li>
              <li>
                <strong>Domicilio y dirección:</strong> {COMPANY.address}
              </li>
              <li>
                <strong>Correo para datos personales:</strong>{' '}
                {COMPANY.privacyEmail}
              </li>
              <li>
                <strong>Teléfono:</strong> {COMPANY.phone}
              </li>
            </ul>
          ),
        },
        {
          id: 'datos',
          title: 'Datos que tratamos',
          content: (
            <>
              <ul>
                <li>
                  <strong>Identificación y contacto:</strong> nombre, correo
                  electrónico, número de teléfono y foto de perfil (si la
                  agregas o si entras con Google).
                </li>
                <li>
                  <strong>Ubicación y direcciones:</strong> direcciones de
                  entrega que guardas y, si lo autorizas en tu dispositivo, tu
                  ubicación aproximada para mostrarte negocios cercanos.
                </li>
                <li>
                  <strong>Pedidos:</strong> productos, montos, notas, historial,
                  calificaciones y comentarios.
                </li>
                <li>
                  <strong>Pagos:</strong> estado y referencia de la transacción.
                  Los datos completos de tarjetas los recibe y procesa
                  directamente la pasarela de pago; no los almacenamos.
                </li>
                <li>
                  <strong>Comercios:</strong> datos del negocio y de su
                  representante, información tributaria y datos para pagos.
                </li>
                <li>
                  <strong>Repartidores:</strong> datos de identificación,
                  contacto y la ubicación del dispositivo{' '}
                  <strong>solo mientras realizan una entrega activa</strong>,
                  para que el Cliente pueda seguir su pedido.
                </li>
                <li>
                  <strong>Datos técnicos:</strong> dirección IP, tipo de
                  navegador y dispositivo, registros de seguridad y errores, y
                  la información descrita en la{' '}
                  <Link href="/cookies">Política de Cookies</Link>.
                </li>
              </ul>
              <p>
                No solicitamos datos sensibles (salud, origen étnico,
                orientación sexual, datos biométricos, entre otros). Si un
                pedido a una farmacia revela información de salud, esta solo se
                usa para gestionar ese pedido y no es obligatorio responder
                preguntas sobre datos sensibles.
              </p>
            </>
          ),
        },
        {
          id: 'finalidades',
          title: 'Para qué usamos tus datos',
          content: (
            <>
              <ol>
                <li>
                  Crear y administrar tu cuenta y autenticarte de forma segura.
                </li>
                <li>
                  Recibir, transmitir al Comercio, procesar, cobrar, entregar y
                  dar seguimiento a tus pedidos.
                </li>
                <li>
                  Compartir con el Comercio y el repartidor los datos necesarios
                  para preparar y entregar tu pedido (nombre, teléfono,
                  dirección y notas).
                </li>
                <li>
                  Enviarte notificaciones sobre el estado de tus pedidos (por
                  correo, notificaciones push o mensajes).
                </li>
                <li>
                  Atender peticiones, quejas, reclamos, reembolsos y garantías.
                </li>
                <li>
                  Prevenir fraude, proteger la seguridad de la Plataforma y
                  cumplir obligaciones legales, contables, tributarias y
                  requerimientos de autoridades.
                </li>
                <li>
                  Elaborar estadísticas agregadas y anónimas para mejorar el
                  servicio.
                </li>
                <li>
                  <strong>Solo si lo autorizaste por separado:</strong> enviarte
                  promociones y novedades. Puedes retirar esa autorización en
                  cualquier momento sin afectar tu cuenta. Respetaremos los
                  horarios y canales de la Ley 2300 de 2023.
                </li>
              </ol>
            </>
          ),
        },
        {
          id: 'derechos',
          title: 'Tus derechos',
          content: (
            <>
              <p>Como titular tienes derecho a (art. 8, Ley 1581 de 2012):</p>
              <ul>
                <li>Conocer, actualizar y rectificar tus datos.</li>
                <li>Solicitar prueba de la autorización que nos diste.</li>
                <li>Ser informado del uso que damos a tus datos.</li>
                <li>
                  Revocar la autorización o pedir la supresión de tus datos,
                  cuando no exista un deber legal o contractual de conservarlos.
                </li>
                <li>Acceder gratuitamente a tus datos.</li>
                <li>
                  Presentar quejas ante la Superintendencia de Industria y
                  Comercio, una vez agotado el trámite de consulta o reclamo
                  ante nosotros.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: 'procedimiento',
          title: 'Cómo ejercer tus derechos',
          content: (
            <>
              <p>
                Escríbenos a <strong>{COMPANY.privacyEmail}</strong> indicando
                tu nombre, el correo o teléfono de tu cuenta, lo que solicitas
                y, si actúas por otra persona, el documento que acredite tu
                representación.
              </p>
              <h3>Consultas</h3>
              <p>
                Respondemos en un máximo de{' '}
                <strong>diez (10) días hábiles</strong> desde que la recibimos.
                Si no es posible, te informaremos los motivos y la fecha de
                respuesta, que no superará cinco (5) días hábiles adicionales
                (art. 14, Ley 1581).
              </p>
              <h3>Reclamos</h3>
              <p>
                Para corregir, actualizar, suprimir datos o alegar un
                incumplimiento, respondemos en un máximo de{' '}
                <strong>quince (15) días hábiles</strong>, prorrogables por ocho
                (8) días hábiles más con aviso previo. Si el reclamo está
                incompleto te pediremos completarlo dentro de los cinco (5) días
                siguientes; si pasan dos (2) meses sin respuesta, se entenderá
                desistido (art. 15, Ley 1581).
              </p>
              <p>Muchos datos puedes actualizarlos tú mismo desde tu perfil.</p>
            </>
          ),
        },
        {
          id: 'terceros',
          title: 'Con quién compartimos tus datos',
          content: (
            <>
              <p>No vendemos tus datos personales. Solo los compartimos con:</p>
              <ul>
                <li>
                  <strong>El Comercio</strong> al que haces el pedido y el{' '}
                  <strong>repartidor</strong> que lo entrega, para cumplirlo.
                  Ellos solo pueden usarlos para ese fin.
                </li>
                <li>
                  <strong>Proveedores que actúan como encargados</strong>, bajo
                  contratos que los obligan a proteger la información:
                  infraestructura y base de datos en la nube (Supabase),
                  pasarelas de pago (Wompi, Mercado Pago), inicio de sesión con
                  Google, envío de SMS y correos, notificaciones push, servicios
                  de mapas y direcciones (OpenStreetMap, OpenRouteService) y
                  monitoreo de errores (Sentry, configurado para no recibir
                  datos personales por defecto).
                </li>
                <li>
                  <strong>Autoridades</strong>, cuando lo exija la ley o una
                  orden judicial o administrativa.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: 'internacional',
          title: 'Transferencia y transmisión internacional',
          content: (
            <p>
              Algunos de nuestros proveedores tienen servidores fuera de
              Colombia (por ejemplo, en Estados Unidos). Al aceptar esta
              Política autorizas expresamente la transmisión de tus datos a esos
              encargados, que solo pueden tratarlos siguiendo nuestras
              instrucciones y con medidas de seguridad adecuadas, conforme a los
              artículos 26 de la Ley 1581 de 2012 y 24 y 25 del Decreto 1377 de
              2013.
            </p>
          ),
        },
        {
          id: 'seguridad',
          title: 'Seguridad',
          content: (
            <p>
              Aplicamos medidas técnicas, humanas y administrativas razonables:
              conexiones cifradas (HTTPS), control de acceso por roles, reglas
              de seguridad a nivel de base de datos, contraseñas cifradas y
              registros de auditoría. Ningún sistema es infalible; si ocurre un
              incidente que afecte tus datos, te lo informaremos y lo
              reportaremos a la Superintendencia de Industria y Comercio
              conforme a la ley.
            </p>
          ),
        },
        {
          id: 'menores',
          title: 'Menores de edad',
          content: (
            <p>
              La Plataforma está dirigida a mayores de 18 años. No recolectamos
              de forma intencional datos de niños, niñas o adolescentes. Si
              detectamos una cuenta de un menor sin autorización de su
              representante legal, la eliminaremos.
            </p>
          ),
        },
        {
          id: 'conservacion',
          title: 'Conservación de los datos',
          content: (
            <p>
              Conservamos tus datos mientras tengas una cuenta activa y,
              después, durante el tiempo necesario para cumplir obligaciones
              legales, contables y tributarias, atender reclamaciones y
              defendernos ante procesos judiciales o administrativos. La prueba
              de tu autorización se conserva durante ese mismo periodo.
            </p>
          ),
        },
        {
          id: 'vigencia',
          title: 'Vigencia',
          content: (
            <p>
              Esta Política rige desde el {LEGAL_UPDATED_AT}. Las bases de datos
              se mantendrán vigentes mientras la Plataforma opere. Si hacemos
              cambios sustanciales te los informaremos y, cuando corresponda, te
              pediremos una nueva autorización.
            </p>
          ),
        },
      ]}
    />
  )
}
