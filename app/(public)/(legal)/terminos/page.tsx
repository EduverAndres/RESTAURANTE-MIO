import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalDocument } from '@/components/legal/legal-document'
import { COMPANY } from '@/lib/legal/company'

export const metadata: Metadata = {
  title: 'Términos y Condiciones',
  description: `Condiciones de uso de ${COMPANY.brand}: cuentas, pedidos, pagos, entregas y responsabilidades.`,
}

const B = COMPANY.brand

export default function TermsPage() {
  return (
    <LegalDocument
      documentKey="terminos"
      title="Términos y Condiciones de Uso"
      intro={
        <>
          <p>
            Estos Términos regulan el uso de {B} (la «Plataforma»), operada por{' '}
            {COMPANY.legalName}, identificada con NIT {COMPANY.nit} y domicilio
            en {COMPANY.address}. Al crear una cuenta, iniciar sesión o hacer un
            pedido declaras que los leíste, los entendiste y los aceptas. Si no
            estás de acuerdo, no uses la Plataforma.
          </p>
          <p>
            Nada en estos Términos limita los derechos que te reconoce la Ley
            1480 de 2011 (Estatuto del Consumidor), que son irrenunciables.
          </p>
        </>
      }
      sections={[
        {
          id: 'naturaleza',
          title: 'Qué es la Plataforma',
          content: (
            <>
              <p>
                {B} es un <strong>portal de contacto</strong> en los términos
                del artículo 53 de la Ley 1480 de 2011: un espacio tecnológico
                donde comercios independientes (restaurantes, panaderías,
                farmacias, tiendas y otros, los «Comercios») ofrecen sus
                productos, y donde los usuarios (los «Clientes») pueden pedirlos
                para domicilio, para recoger o desde la mesa.
              </p>
              <p>
                <strong>
                  El vendedor de cada producto es el Comercio que lo ofrece, no{' '}
                  {B}.
                </strong>{' '}
                El Comercio es quien fija precios, prepara, empaca y responde
                por la calidad, idoneidad, seguridad, cantidad, información y
                garantía de lo que vende, así como por la expedición de la
                factura correspondiente. {B} facilita la tecnología, el proceso
                de pedido y pago, y el seguimiento.
              </p>
              <p>
                En cumplimiento del artículo 53 de la Ley 1480, exigimos a cada
                Comercio su información de identificación (razón social o
                nombre, documento o NIT, dirección, teléfono y correo) y la
                ponemos a disposición del Cliente que la solicite para presentar
                una reclamación.
              </p>
            </>
          ),
        },
        {
          id: 'cuentas',
          title: 'Cuentas y requisitos',
          content: (
            <>
              <ul>
                <li>
                  Debes ser mayor de 18 años y tener capacidad legal para
                  contratar. Los menores solo pueden usar la Plataforma a través
                  de su representante legal.
                </li>
                <li>
                  La información que registres debe ser veraz y estar
                  actualizada. Eres responsable de lo que ocurra con tu cuenta y
                  de mantener tu contraseña en secreto.
                </li>
                <li>
                  Avísanos de inmediato si sospechas un uso no autorizado de tu
                  cuenta.
                </li>
                <li>
                  Podemos suspender o cancelar cuentas que incumplan estos
                  Términos, suministren información falsa, cometan fraude o
                  abusen de la Plataforma, de los Comercios o de los
                  repartidores.
                </li>
              </ul>
              <p>
                La aceptación electrónica de estos Términos tiene plena validez
                jurídica conforme a la Ley 527 de 1999.
              </p>
            </>
          ),
        },
        {
          id: 'pedidos',
          title: 'Pedidos, precios y disponibilidad',
          content: (
            <>
              <ul>
                <li>
                  Los precios se muestran en pesos colombianos (COP) e incluyen
                  los impuestos aplicables según el régimen de cada Comercio.
                  Antes de confirmar verás el total: productos, costo de envío y
                  propina voluntaria, si la eliges.
                </li>
                <li>
                  Un pedido se perfecciona cuando el Comercio lo acepta. Hasta
                  ese momento puedes cancelarlo sin costo desde la Plataforma.
                </li>
                <li>
                  El Comercio puede rechazar un pedido por falta de
                  disponibilidad, horario o zona de cobertura. Si ya pagaste, se
                  te reembolsa el valor completo por el mismo medio de pago.
                </li>
                <li>
                  Las fotos de los productos son ilustrativas y las publica el
                  Comercio. La descripción, ingredientes, alérgenos y
                  advertencias son su responsabilidad. Si tienes alergias o
                  restricciones, consulta al Comercio antes de pedir.
                </li>
                <li>
                  Cada Comercio puede fijar un pedido mínimo, que se informa
                  antes de pagar.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: 'pagos',
          title: 'Pagos',
          content: (
            <>
              <p>
                Los pagos en línea se procesan a través de pasarelas de pago
                autorizadas (como Wompi o Mercado Pago). Los datos de tu tarjeta
                o cuenta los recibe y procesa directamente la pasarela; {B} no
                los almacena. Algunos Comercios aceptan también pago en efectivo
                al recibir.
              </p>
              <p>
                Cuando un pedido se cancela o rechaza después de pagado, el
                reembolso se tramita por el mismo medio de pago. Los tiempos de
                acreditación dependen de la pasarela y de tu entidad financiera.
              </p>
            </>
          ),
        },
        {
          id: 'entregas',
          title: 'Entregas y tiempos',
          content: (
            <>
              <ul>
                <li>
                  Los tiempos de entrega son <strong>estimados</strong>, se
                  calculan con la distancia y el tiempo de preparación informado
                  por el Comercio, y pueden variar por tráfico, clima o demanda.
                </li>
                <li>
                  Debes indicar una dirección correcta y estar disponible para
                  recibir. Si el pedido no puede entregarse por causas
                  atribuibles a ti (dirección errada, ausencia, falta de
                  respuesta), podrá no proceder el reembolso del valor ya
                  preparado.
                </li>
                <li>
                  Algunos pedidos se confirman con un{' '}
                  <strong>código de entrega</strong>. No lo compartas hasta
                  tener el pedido en tus manos: entregarlo equivale a confirmar
                  que lo recibiste.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: 'restringidos',
          title: 'Productos de venta restringida',
          content: (
            <>
              <p>
                Las bebidas alcohólicas y los productos de tabaco solo se venden
                a mayores de 18 años (Ley 124 de 1994, Ley 1335 de 2009 y Ley
                1098 de 2006). Quien recibe el pedido puede ser requerido a
                mostrar un documento de identidad; si no lo presenta o es menor
                de edad, el producto no se entregará.
              </p>
              <p>
                Los medicamentos se venden conforme a la normativa sanitaria
                vigente. Los de venta bajo fórmula médica exigen la prescripción
                correspondiente, que el Comercio (farmacia o droguería) debe
                verificar.
              </p>
            </>
          ),
        },
        {
          id: 'derechos',
          title: 'Retracto, reversión y garantías',
          content: (
            <p>
              Tus derechos como consumidor (retracto, reversión del pago,
              garantía legal y la forma de reclamar) se explican en la{' '}
              <Link href="/proteccion-al-consumidor">
                Política de Protección al Consumidor
              </Link>
              , que hace parte de estos Términos.
            </p>
          ),
        },
        {
          id: 'conducta',
          title: 'Uso permitido',
          content: (
            <>
              <p>Al usar la Plataforma te comprometes a no:</p>
              <ul>
                <li>
                  Hacer pedidos falsos, de broma o con medios de pago que no te
                  pertenecen.
                </li>
                <li>
                  Acosar, amenazar o discriminar a Comercios, repartidores u
                  otros usuarios.
                </li>
                <li>
                  Publicar reseñas falsas, ofensivas, con datos personales de
                  terceros o que no correspondan a una experiencia real.
                </li>
                <li>
                  Intentar acceder sin autorización a sistemas, cuentas o datos,
                  extraer información de forma masiva o interferir con el
                  funcionamiento de la Plataforma.
                </li>
                <li>Usar la Plataforma para cualquier fin ilícito.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'resenas',
          title: 'Reseñas y contenido de usuarios',
          content: (
            <p>
              Las calificaciones y comentarios que publiques deben reflejar tu
              experiencia real con un pedido. Al publicarlos nos autorizas a
              mostrarlos en la Plataforma, de forma gratuita y sin límite
              territorial, identificándote solo de forma genérica (por ejemplo,
              «Cliente de» el Comercio). Podemos retirar contenido que incumpla
              estos Términos o la ley.
            </p>
          ),
        },
        {
          id: 'propiedad',
          title: 'Propiedad intelectual',
          content: (
            <p>
              El software, diseño, marca {B} y demás elementos de la Plataforma
              pertenecen a {COMPANY.legalName} o a sus licenciantes. Las marcas,
              logos, fotos y cartas de cada Comercio pertenecen a ese Comercio.
              No puedes copiar, modificar ni explotar comercialmente ninguno de
              estos elementos sin autorización previa y escrita.
            </p>
          ),
        },
        {
          id: 'responsabilidad',
          title: 'Alcance de nuestra responsabilidad',
          content: (
            <>
              <p>
                {B} responde por el correcto funcionamiento de la tecnología que
                ofrece y por las obligaciones que la ley impone a los portales
                de contacto. Sin perjuicio de los derechos irrenunciables del
                consumidor y en la máxima medida permitida por la ley:
              </p>
              <ul>
                <li>
                  La responsabilidad por la calidad, idoneidad, seguridad,
                  garantía y facturación de los productos corresponde al
                  Comercio que los vende.
                </li>
                <li>
                  No garantizamos que la Plataforma esté disponible sin
                  interrupciones; podemos suspenderla para mantenimiento o por
                  causas de fuerza mayor o caso fortuito.
                </li>
                <li>
                  No respondemos por daños derivados del uso indebido de tu
                  cuenta por causas imputables a ti, ni por fallas de redes,
                  dispositivos o servicios de terceros fuera de nuestro control.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: 'datos',
          title: 'Datos personales y cookies',
          content: (
            <p>
              Tratamos tus datos conforme a la{' '}
              <Link href="/privacidad">
                Política de Tratamiento de Datos Personales
              </Link>{' '}
              y usamos cookies según la{' '}
              <Link href="/cookies">Política de Cookies</Link>. Ambas hacen
              parte de estos Términos.
            </p>
          ),
        },
        {
          id: 'cambios',
          title: 'Cambios a estos Términos',
          content: (
            <p>
              Podemos modificar estos Términos. Cuando el cambio sea sustancial
              te lo informaremos y te pediremos aceptarlo de nuevo antes de
              seguir usando la Plataforma. La versión vigente y su fecha
              aparecen siempre al inicio de este documento.
            </p>
          ),
        },
        {
          id: 'ley',
          title: 'Ley aplicable y reclamaciones',
          content: (
            <>
              <p>
                Estos Términos se rigen por las leyes de la República de
                Colombia. Antes de cualquier acción, te invitamos a escribirnos
                a {COMPANY.email} para buscar una solución directa.
              </p>
              <p>
                Como consumidor puedes acudir en cualquier momento a la{' '}
                <a
                  href="https://www.sic.gov.co"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Superintendencia de Industria y Comercio
                </a>{' '}
                o a los jueces competentes de Colombia.
              </p>
            </>
          ),
        },
      ]}
    />
  )
}
