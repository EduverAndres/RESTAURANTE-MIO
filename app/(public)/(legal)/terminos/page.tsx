import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  LegalDocument,
  type LegalSection,
} from '@/components/legal/legal-document'
import { COMPANY } from '@/lib/legal/company'

export const metadata: Metadata = {
  title: 'Términos y Condiciones',
  description: `Términos y Condiciones de Uso de ${COMPANY.brand}: naturaleza de la plataforma, cuentas, pedidos, pagos, entregas, derechos del consumidor y responsabilidades.`,
}

const B = COMPANY.brand

/**
 * A clause that opens a list ("…se abstendrá de:" followed by items). A list
 * cannot live inside the clause's <p>, so it is rendered right after it.
 */
class ListClause {
  constructor(
    readonly text: ReactNode,
    readonly items: ReactNode[],
  ) {}
}

type Clause = ReactNode | ListClause

const withList = (text: ReactNode, items: ReactNode[]) =>
  new ListClause(text, items)

interface TermsSection {
  id: string
  title: string
  lead?: ReactNode
  clauses: Clause[]
}

/**
 * Numbers every clause after its section ("3.1.", "3.2."…), so a clause can
 * be cited precisely in a claim or a reply and the numbering never drifts
 * when a section is added or moved. The section number itself is the one
 * `LegalDocument` prints, which follows the same order.
 */
function numberClauses(sections: TermsSection[]): LegalSection[] {
  return sections.map((section, sectionIndex) => ({
    id: section.id,
    title: section.title,
    content: (
      <>
        {section.lead}
        {section.clauses.map((clause, clauseIndex) => {
          const number = `${sectionIndex + 1}.${clauseIndex + 1}.`
          const isList = clause instanceof ListClause
          return (
            <div key={number}>
              <p>
                <strong className="tabular-nums">{number}</strong>{' '}
                {isList ? clause.text : clause}
              </p>
              {isList ? (
                <ul>
                  {clause.items.map((item, itemIndex) => (
                    <li key={itemIndex}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          )
        })}
      </>
    ),
  }))
}

const SECTIONS: TermsSection[] = [
  {
    id: 'definiciones',
    title: 'Definiciones',
    lead: (
      <p>
        Para efectos de estos Términos, las siguientes expresiones tienen el
        significado que se indica, ya sea que se usen en singular o en plural:
      </p>
    ),
    clauses: [
      <>
        <strong>Plataforma:</strong> el sitio web, las aplicaciones y los demás
        canales digitales de {B}, junto con el software, los contenidos y las
        funcionalidades que los integran.
      </>,
      <>
        <strong>Usuario:</strong> toda persona que accede a la Plataforma o la
        utiliza, con o sin cuenta registrada.
      </>,
      <>
        <strong>Cliente:</strong> el Usuario que realiza un Pedido en calidad de
        consumidor final.
      </>,
      <>
        <strong>Comercio:</strong> la persona natural o jurídica independiente
        (restaurante, panadería, farmacia, droguería, tienda u otro
        establecimiento) que ofrece y vende sus productos a través de la
        Plataforma.
      </>,
      <>
        <strong>Repartidor:</strong> la persona que realiza la entrega de los
        Pedidos a domicilio, en las condiciones de los{' '}
        <Link href="/terminos-aliados">
          Términos para Comercios y Repartidores
        </Link>
        .
      </>,
      <>
        <strong>Pedido:</strong> la solicitud de compra de uno o varios
        productos de un Comercio que el Cliente realiza a través de la
        Plataforma, para entrega a domicilio, para recoger en el establecimiento
        o para consumo en mesa.
      </>,
      <>
        <strong>Pasarela de Pago:</strong> la entidad autorizada que procesa los
        pagos electrónicos realizados en la Plataforma.
      </>,
      <>
        <strong>Contenido de Usuario:</strong> las calificaciones, reseñas,
        comentarios y demás información que el Usuario publica o transmite a
        través de la Plataforma.
      </>,
      <>
        <strong>Código de Entrega:</strong> la clave asociada a un Pedido que el
        Cliente suministra al Repartidor como constancia de recibo.
      </>,
    ],
  },
  {
    id: 'naturaleza',
    title: 'Objeto y naturaleza de la Plataforma',
    clauses: [
      <>
        {B} es un <strong>portal de contacto</strong> en los términos del
        artículo 53 de la Ley 1480 de 2011: una plataforma electrónica en la que
        los Comercios ofrecen sus productos y en la que los Clientes pueden
        contactarlos y realizar Pedidos para entrega a domicilio, para recoger o
        para consumo en mesa.
      </>,
      <>
        <strong>
          El vendedor de cada producto es el Comercio que lo ofrece, no {B}.
        </strong>{' '}
        {B} no produce, prepara, almacena, empaca ni vende los productos
        publicados por los Comercios. Corresponde al Comercio fijar sus precios,
        preparar y empacar los productos, y responder por su calidad, idoneidad,
        seguridad, inocuidad, cantidad e información, por la garantía legal y
        por la expedición de la factura electrónica de venta.
      </>,
      <>
        {B} presta al Usuario los servicios tecnológicos de la Plataforma: la
        exhibición de los catálogos, la gestión y el seguimiento de los Pedidos,
        la intermediación en el pago a través de Pasarelas de Pago, las
        notificaciones y la atención de peticiones, quejas y reclamos. {B}{' '}
        responde por la adecuada prestación de estos servicios en los términos
        de la ley.
      </>,
      <>
        En cumplimiento del artículo 53 de la Ley 1480 de 2011, {B} exige a cada
        Comercio la información que permite identificarlo (nombre o razón
        social, documento de identidad o NIT, dirección física de notificaciones
        y teléfono), la conserva en un registro y la suministra al Cliente que
        la solicite para presentar una queja o reclamo, así como a la autoridad
        competente que la requiera.
      </>,
      <>
        Los Comercios son independientes de {B} y actúan en su propio nombre. La
        relación de {B} con los Comercios y con los Repartidores se rige por los{' '}
        <Link href="/terminos-aliados">
          Términos para Comercios y Repartidores
        </Link>
        .
      </>,
    ],
  },
  {
    id: 'cuentas',
    title: 'Registro, cuenta y capacidad',
    clauses: [
      'Para realizar Pedidos es necesario crear una cuenta. El Usuario debe ser mayor de dieciocho (18) años y tener plena capacidad legal para contratar. Los menores de edad solo pueden usar la Plataforma por intermedio de su representante legal, quien responde por dicho uso.',
      <>
        El Usuario se obliga a suministrar información veraz, completa y
        actualizada, y a mantenerla al día. {B} podrá solicitar información
        adicional para verificar la identidad del Usuario o prevenir el fraude.
      </>,
      'Las credenciales de acceso son personales e intransferibles. El Usuario debe mantenerlas en reserva y responde por las actividades realizadas desde su cuenta cuando obedezcan a su culpa o al incumplimiento de su deber de custodia.',
      'El acceso puede realizarse con correo electrónico y contraseña, con un código enviado por SMS o mediante cuentas de terceros, como Google o Microsoft. El uso de estos servicios de terceros se rige, además, por sus propias condiciones.',
      <>
        El Usuario debe informar de inmediato a {COMPANY.email} cualquier uso no
        autorizado de su cuenta o vulneración de sus credenciales.
      </>,
      'Cada persona puede tener una sola cuenta como Cliente. La cuenta no puede cederse, venderse ni transferirse a terceros.',
      <>
        {B} podrá suspender o cancelar la cuenta del Usuario que incumpla estos
        Términos, suministre información falsa, cometa o intente cometer fraude,
        o ponga en riesgo a otros Usuarios, a los Comercios o a los
        Repartidores. Cuando sea posible, informará previamente el motivo. La
        suspensión o cancelación no afecta los Pedidos en curso ni los
        reembolsos, garantías y reclamaciones pendientes.
      </>,
      <>
        El Usuario puede solicitar en cualquier momento el cierre de su cuenta
        escribiendo a {COMPANY.privacyEmail}, sin costo y sin más requisitos que
        la verificación razonable de su identidad. Sus datos se conservarán solo
        durante el tiempo que exija la ley, conforme a la{' '}
        <Link href="/privacidad">
          Política de Tratamiento de Datos Personales
        </Link>
        .
      </>,
      <>
        La aceptación electrónica de estos Términos tiene plena validez y
        efectos jurídicos conforme a la Ley 527 de 1999. {B} conserva constancia
        de la versión aceptada y de la fecha y hora de la aceptación.
      </>,
    ],
  },
  {
    id: 'pedidos',
    title: 'Pedidos, precios y disponibilidad',
    clauses: [
      'La descripción, el precio, las fotografías, los ingredientes, los alérgenos y las advertencias de cada producto son publicados por el Comercio, bajo su exclusiva responsabilidad. Las fotografías tienen carácter ilustrativo, pero el producto entregado debe corresponder en sus características esenciales a lo ofrecido.',
      'Los precios se expresan en pesos colombianos (COP) e incluyen los impuestos aplicables según el régimen tributario de cada Comercio. Antes de confirmar el Pedido, el Cliente verá un resumen con el valor de los productos, los descuentos aplicados, el costo de envío, la propina voluntaria que haya elegido y el valor total a pagar.',
      'Para realizar un Pedido, el Cliente selecciona los productos, elige la modalidad de entrega, indica la dirección cuando corresponda, selecciona el medio de pago, revisa el resumen y confirma. La Plataforma le informará la recepción del Pedido y le permitirá consultar su estado en todo momento.',
      'El Pedido se perfecciona cuando el Comercio lo acepta. Hasta ese momento, el Cliente puede cancelarlo sin costo desde la Plataforma. Una vez aceptado, el Comercio inicia la preparación y la cancelación queda sujeta a su aceptación, sin perjuicio de los derechos que la ley reconoce al consumidor.',
      'El Comercio puede rechazar un Pedido por falta de disponibilidad, por encontrarse fuera de su horario o zona de cobertura, o por otra causa justificada. Si el Pedido ya había sido pagado, se reembolsará su valor total por el mismo medio de pago.',
      'Cada Comercio define su horario, su zona de cobertura y, si lo desea, un valor mínimo de Pedido. Estas condiciones se informan antes del pago.',
      'El Cliente con alergias, intolerancias o restricciones alimentarias debe consultarlo con el Comercio antes de realizar el Pedido. Las instrucciones especiales que incluya en las notas serán atendidas por el Comercio en la medida de sus posibilidades.',
    ],
  },
  {
    id: 'promociones',
    title: 'Descuentos, cupones y promociones',
    clauses: [
      <>
        Los Comercios y {B} pueden ofrecer cupones, descuentos, beneficios de
        fidelización o créditos por referidos. Cada beneficio indicará sus
        condiciones: vigencia, valor o porcentaje, productos o Comercios a los
        que aplica, valor mínimo de Pedido y número de usos permitidos.
      </>,
      'Las promociones obligan a quien las ofrece, en los términos anunciados y durante su vigencia (art. 33, Ley 1480 de 2011). El descuento se refleja en el resumen del Pedido antes del pago.',
      'Salvo indicación en contrario, los beneficios son personales e intransferibles, no son acumulables entre sí y no son canjeables por dinero.',
      <>
        {B} podrá anular los beneficios obtenidos de forma fraudulenta o
        contraria a sus condiciones, como el uso de cuentas múltiples o de
        información falsa, y adoptar las demás medidas previstas en estos
        Términos.
      </>,
    ],
  },
  {
    id: 'pagos',
    title: 'Pagos, reembolsos y facturación',
    clauses: [
      'Los pagos en línea se procesan a través de Pasarelas de Pago autorizadas, como Wompi o Mercado Pago, con los medios que cada una habilite. Cuando el Comercio lo permita, el Cliente también puede pagar en efectivo al recibir o al recoger el Pedido. Los medios disponibles se informan antes de confirmar el Pedido.',
      <>
        Los datos de la tarjeta o de la cuenta financiera del Cliente son
        recibidos y procesados directamente por la Pasarela de Pago, conforme a
        sus estándares de seguridad. {B} no almacena números de tarjeta, códigos
        de seguridad ni credenciales bancarias. El uso de la Pasarela de Pago se
        rige, además, por sus propias condiciones.
      </>,
      <>
        El pago en línea se entiende realizado cuando la Pasarela de Pago
        confirma la aprobación de la transacción. {B} y las Pasarelas de Pago
        pueden verificar, rechazar o retener transacciones ante indicios
        razonables de fraude o de uso no autorizado del medio de pago, lo cual
        se informará al Cliente.
      </>,
      'Cuando proceda un reembolso, se tramitará por el mismo medio de pago utilizado. El plazo de acreditación depende de la Pasarela de Pago y de la entidad financiera del Cliente. El reembolso de un Pedido pagado en efectivo se acordará con el Cliente por un medio que permita su verificación.',
      <>
        La propina es voluntaria y el Cliente decide su valor, incluida la
        opción de no darla. Se entrega íntegramente al Repartidor, en los
        Pedidos a domicilio, o al equipo del Comercio, en los demás casos. {B}{' '}
        no retiene parte alguna de ella.
      </>,
      'La factura electrónica de venta de los productos la expide el Comercio, que es el vendedor. El Cliente puede solicitarla al Comercio suministrando los datos que exige la normativa tributaria.',
    ],
  },
  {
    id: 'entregas',
    title: 'Entregas, recogida y consumo en mesa',
    clauses: [
      <>
        Los tiempos de entrega informados son <strong>estimados</strong>: se
        calculan con base en la distancia y en el tiempo de preparación indicado
        por el Comercio, y pueden variar por tráfico, clima, demanda u otras
        circunstancias.
      </>,
      'El Cliente debe indicar una dirección exacta y un número de contacto vigente, y estar disponible para recibir el Pedido.',
      'Si, pese a los intentos razonables de contacto del Repartidor o del Comercio, el Pedido no puede entregarse por causas imputables al Cliente (dirección errada o incompleta, ausencia, falta de respuesta o negativa injustificada a recibir), podrá no proceder el reembolso del valor de los productos ya preparados ni del costo de envío, dada la naturaleza perecedera de los productos y el servicio ya prestado.',
      <>
        Algunos Pedidos se confirman con un <strong>Código de Entrega</strong>.
        El Cliente solo debe suministrarlo cuando tenga el Pedido en su poder:
        suministrarlo constituye constancia de que lo recibió. Se recomienda
        revisar el Pedido al recibirlo e informar de inmediato cualquier
        inconsistencia.
      </>,
      'En los Pedidos para recoger, el Cliente debe acudir al establecimiento dentro de su horario de atención y presentar el número del Pedido.',
      'Los Pedidos realizados desde la mesa, mediante el código QR del establecimiento, se entregan en el mismo establecimiento. La atención en el local es responsabilidad del Comercio.',
      'Durante una entrega activa, la Plataforma muestra al Cliente la ubicación del Repartidor para que pueda seguir el avance del Pedido.',
    ],
  },
  {
    id: 'restringidos',
    title: 'Productos de venta restringida',
    clauses: [
      'Las bebidas alcohólicas y los productos de tabaco solo se venden a mayores de dieciocho (18) años (Ley 124 de 1994, Ley 1335 de 2009 y Ley 1098 de 2006). Al pedirlos, el Cliente declara ser mayor de edad. Quien reciba el Pedido deberá exhibir su documento de identidad si se le solicita; si no lo hace o es menor de edad, el producto restringido no se entregará.',
      <>
        Los medicamentos se venden conforme a la normativa sanitaria vigente,
        únicamente por droguerías y farmacias habilitadas. Los de venta bajo
        fórmula médica exigen la prescripción correspondiente, que el Comercio
        debe verificar; si no se presenta, el Pedido podrá ser rechazado. {B} no
        presta servicios de salud ni de asesoría farmacéutica.
      </>,
      <>
        Está prohibido ofrecer o solicitar a través de la Plataforma productos
        cuya comercialización sea ilícita. {B} podrá retirar cualquier
        publicación contraria a la ley.
      </>,
    ],
  },
  {
    id: 'derechos',
    title: 'Derechos del consumidor: garantía, retracto y reversión del pago',
    clauses: [
      'Todo producto debe entregarse en las condiciones de calidad, idoneidad y seguridad ofrecidas (art. 7, Ley 1480 de 2011). Si el Pedido llega incompleto, equivocado, en mal estado o no apto para el consumo, el Cliente debe reportarlo apenas lo reciba, preferiblemente con fotografías y el número del Pedido, para que el Comercio reponga el producto o devuelva el dinero, según corresponda.',
      'El derecho de retracto (art. 47, Ley 1480 de 2011) no aplica a los bienes perecederos ni a los que por su naturaleza no pueden devolverse o se deterioran con rapidez. Por esa razón, las comidas preparadas, los alimentos perecederos y los medicamentos no admiten retracto, sin perjuicio de la garantía legal.',
      'El Cliente que haya pagado con un instrumento de pago electrónico puede solicitar la reversión del pago en los casos y plazos previstos en el artículo 51 de la Ley 1480 de 2011.',
      <>
        Las condiciones y el procedimiento para ejercer estos derechos se
        detallan en la{' '}
        <Link href="/proteccion-al-consumidor">
          Política de Protección al Consumidor
        </Link>
        , que forma parte integral de estos Términos.
      </>,
    ],
  },
  {
    id: 'pqr',
    title: 'Atención al cliente, peticiones, quejas y reclamos',
    clauses: [
      <>
        El Usuario puede presentar peticiones, quejas, reclamos y solicitudes de
        garantía al correo <strong>{COMPANY.email}</strong> o al teléfono{' '}
        <strong>{COMPANY.phone}</strong>, indicando su nombre, el número del
        Pedido, la descripción de la situación y, si las tiene, las pruebas que
        la soporten.
      </>,
      <>
        {B} responderá dentro de los quince (15) días hábiles siguientes a la
        recepción. Cuando el asunto corresponda al producto, trasladará el caso
        al Comercio, hará seguimiento a su respuesta y, si el Comercio no
        responde, suministrará al Cliente sus datos de identificación para que
        pueda ejercer sus derechos.
      </>,
      <>
        El Cliente también puede acudir a la{' '}
        <a
          href="https://www.sic.gov.co"
          target="_blank"
          rel="noopener noreferrer"
        >
          Superintendencia de Industria y Comercio
        </a>
        , autoridad nacional de protección al consumidor.
      </>,
    ],
  },
  {
    id: 'conducta',
    title: 'Uso permitido y conductas prohibidas',
    clauses: [
      withList(
        'El Usuario se obliga a usar la Plataforma de buena fe y conforme a la ley. En particular, se abstendrá de:',
        [
          'Realizar Pedidos falsos o de broma, o usar medios de pago que no le pertenezcan o para los que no tenga autorización.',
          <>
            Acosar, amenazar, discriminar o agredir a Comercios, Repartidores,
            otros Usuarios o personal de {B}.
          </>,
          'Suplantar la identidad de otra persona o crear cuentas con información falsa.',
          'Publicar reseñas falsas, ofensivas o que no correspondan a una experiencia real, o que contengan datos personales de terceros.',
          'Abusar de las cancelaciones, reclamaciones, reembolsos o promociones.',
          'Acceder o intentar acceder sin autorización a sistemas, cuentas o datos; eludir las medidas de seguridad; introducir código malicioso; extraer información de forma masiva o automatizada; aplicar ingeniería inversa, o interferir con el funcionamiento de la Plataforma.',
          'Usar la Plataforma con fines comerciales no autorizados o para cualquier fin ilícito.',
        ],
      ),
      <>
        El incumplimiento faculta a {B} para retirar el contenido, anular
        beneficios, suspender o cancelar la cuenta y, cuando corresponda, poner
        los hechos en conocimiento de las autoridades, incluidas las conductas
        tipificadas en la Ley 1273 de 2009 sobre delitos informáticos.
      </>,
    ],
  },
  {
    id: 'resenas',
    title: 'Reseñas y contenido de usuarios',
    clauses: [
      'Solo los Clientes con un Pedido entregado pueden calificar al Comercio y los productos de ese Pedido. Las calificaciones y comentarios deben reflejar una experiencia real, expresarse de forma respetuosa y no incluir datos personales de terceros, publicidad ni contenido ofensivo, discriminatorio o ilícito.',
      <>
        Al publicar Contenido de Usuario, el Usuario declara ser su autor y
        otorga a {B} una autorización gratuita, no exclusiva y sin límite
        territorial para reproducirlo y mostrarlo en la Plataforma mientras
        permanezca publicado.
      </>,
      'Las reseñas identifican al autor únicamente con su nombre de pila o de forma genérica (por ejemplo, «Cliente de» el Comercio). Nunca se publican sus apellidos, teléfono, correo electrónico ni dirección.',
      <>
        Las reseñas expresan la opinión de sus autores y no la de {B}. {B} podrá
        ocultar el contenido que incumpla estos Términos o la ley, sin modificar
        su texto. Los Comercios no pueden eliminar ni condicionar las reseñas
        legítimas.
      </>,
      'El Usuario responde por el Contenido de Usuario que publique.',
    ],
  },
  {
    id: 'propiedad',
    title: 'Propiedad intelectual',
    clauses: [
      <>
        El software, el diseño, la marca {B}, sus logotipos y los demás
        elementos de la Plataforma son de propiedad de {COMPANY.legalName} o de
        sus licenciantes, y están protegidos por las normas de derecho de autor
        y de propiedad industrial, en especial la Ley 23 de 1982 y las
        Decisiones 351 de 1993 y 486 de 2000 de la Comunidad Andina.
      </>,
      <>
        {B} concede al Usuario una licencia limitada, personal, no exclusiva,
        intransferible y revocable para usar la Plataforma con fines personales
        y no comerciales, conforme a estos Términos.
      </>,
      'Sin autorización previa y escrita del titular, el Usuario no podrá copiar, reproducir, modificar, distribuir, descompilar, enmarcar ni explotar comercialmente ninguno de estos elementos.',
      <>
        Las marcas, logotipos, fotografías y cartas de cada Comercio son de su
        propiedad o de sus licenciantes. Quien considere que un contenido de la
        Plataforma infringe sus derechos puede informarlo a {COMPANY.email}.
      </>,
    ],
  },
  {
    id: 'disponibilidad',
    title: 'Disponibilidad y servicios de terceros',
    clauses: [
      <>
        {B} procurará que la Plataforma esté disponible de forma continua, pero
        no garantiza que funcione sin interrupciones ni errores. Podrá
        suspenderla temporalmente por mantenimiento, actualizaciones, razones de
        seguridad, fuerza mayor o caso fortuito, y procurará avisar con
        anticipación las interrupciones programadas.
      </>,
      <>
        {B} puede modificar, ampliar o retirar funcionalidades de la Plataforma,
        sin afectar los Pedidos en curso.
      </>,
      <>
        La Plataforma integra servicios de terceros, como Pasarelas de Pago,
        mapas, inicio de sesión, mensajería y notificaciones. Estos servicios se
        rigen por las condiciones de sus proveedores, y {B} no responde por sus
        fallas cuando no le sean imputables.
      </>,
    ],
  },
  {
    id: 'responsabilidad',
    title: 'Alcance de la responsabilidad',
    clauses: [
      <>
        {B} responde por la adecuada prestación de los servicios tecnológicos a
        su cargo y por las obligaciones que la ley impone a los portales de
        contacto.
      </>,
      'La responsabilidad por la calidad, idoneidad, seguridad, inocuidad, garantía y facturación de los productos corresponde al Comercio que los vende, en los términos de la Ley 1480 de 2011.',
      withList(
        <>
          En la máxima medida permitida por la ley, {B} no responde por los
          daños derivados de:
        </>,
        [
          'El uso indebido de la cuenta por causas imputables al Usuario.',
          'Fallas de redes, dispositivos, conexiones o servicios de terceros ajenos a su control.',
          'Hechos constitutivos de fuerza mayor o caso fortuito.',
          'El Contenido de Usuario publicado por terceros.',
        ],
      ),
      <>
        Ninguna disposición de estos Términos excluye la responsabilidad de {B}{' '}
        por dolo o culpa grave, ni limita los derechos irrenunciables del
        consumidor.
      </>,
    ],
  },
  {
    id: 'indemnidad',
    title: 'Indemnidad',
    clauses: [
      <>
        El Usuario mantendrá indemne a {COMPANY.legalName}, a sus
        administradores y a sus empleados frente a las reclamaciones de
        terceros, sanciones y gastos razonables que se deriven del
        incumplimiento de estos Términos por parte del Usuario, del Contenido de
        Usuario que publique o del uso ilícito de la Plataforma, en la medida en
        que tales hechos le sean imputables.
      </>,
    ],
  },
  {
    id: 'datos',
    title: 'Datos personales y cookies',
    clauses: [
      <>
        {B} trata los datos personales conforme a la Ley 1581 de 2012, sus
        decretos reglamentarios y la{' '}
        <Link href="/privacidad">
          Política de Tratamiento de Datos Personales
        </Link>
        , y usa cookies según la{' '}
        <Link href="/cookies">Política de Cookies</Link>. Ambas forman parte
        integral de estos Términos.
      </>,
      <>
        Para cumplir cada Pedido, {B} comparte con el Comercio y, cuando
        corresponda, con el Repartidor, los datos necesarios para prepararlo y
        entregarlo, como el nombre, el teléfono, la dirección y las notas del
        Cliente.
      </>,
      <>
        {B} solo enviará comunicaciones comerciales o publicitarias al Usuario
        que lo haya autorizado de forma previa y expresa, autorización que puede
        revocar en cualquier momento. Las comunicaciones sobre el estado de los
        Pedidos y la seguridad de la cuenta forman parte del servicio.
      </>,
      <>
        El titular puede ejercer sus derechos a conocer, actualizar, rectificar
        y suprimir sus datos, así como revocar la autorización, escribiendo a{' '}
        {COMPANY.privacyEmail}.
      </>,
    ],
  },
  {
    id: 'comunicaciones',
    title: 'Comunicaciones y notificaciones',
    clauses: [
      'El Usuario acepta recibir comunicaciones por medios electrónicos, como correo electrónico, SMS, notificaciones push y avisos dentro de la Plataforma. Estas comunicaciones producen plenos efectos conforme a la Ley 527 de 1999.',
      <>
        El Usuario debe mantener actualizados sus datos de contacto. Las
        comunicaciones dirigidas a {B} deben enviarse a {COMPANY.email}.
      </>,
    ],
  },
  {
    id: 'cambios',
    title: 'Modificaciones de estos Términos',
    clauses: [
      <>
        {B} puede modificar estos Términos para reflejar cambios legales,
        regulatorios, técnicos o de los servicios de la Plataforma.
      </>,
      'Cuando la modificación sea sustancial, se informará a través de la Plataforma y se solicitará al Usuario una nueva aceptación expresa antes de que continúe usándola. Los cambios no sustanciales, como correcciones de redacción o actualizaciones de datos, se publicarán con su nueva fecha.',
      'Las modificaciones no tienen efecto retroactivo: cada Pedido se rige por la versión de los Términos vigente al momento de su confirmación.',
      'Si el Usuario no está de acuerdo con la nueva versión, puede dejar de usar la Plataforma y solicitar el cierre de su cuenta.',
      <>
        La versión vigente y su fecha se indican al inicio de este documento.
        Las versiones anteriores pueden solicitarse a {COMPANY.email}.
      </>,
    ],
  },
  {
    id: 'generales',
    title: 'Disposiciones generales',
    clauses: [
      <>
        Estos Términos, junto con la Política de Tratamiento de Datos
        Personales, la Política de Cookies y la Política de Protección al
        Consumidor, constituyen el acuerdo completo entre el Usuario y {B} sobre
        el uso de la Plataforma. A los Comercios y Repartidores se les aplican,
        además, los Términos para Comercios y Repartidores.
      </>,
      'En caso de duda o contradicción, prevalecerá la interpretación más favorable al consumidor (art. 34, Ley 1480 de 2011).',
      'Si alguna disposición es declarada nula o ineficaz, las demás conservarán plena validez.',
      <>
        La falta de ejercicio de un derecho por parte de {B} no implica renuncia
        a él.
      </>,
      <>
        El Usuario no puede ceder su posición en estos Términos. {B} podrá
        cederla en caso de fusión, escisión, adquisición o reorganización
        empresarial, informándolo al Usuario y garantizando sus derechos.
      </>,
      'Los títulos de las secciones son indicativos y no afectan la interpretación de su contenido.',
    ],
  },
  {
    id: 'ley',
    title: 'Ley aplicable y solución de controversias',
    clauses: [
      'Estos Términos se rigen por las leyes de la República de Colombia.',
      <>
        Antes de iniciar cualquier acción, el Usuario puede presentar su
        reclamación directa a {COMPANY.email}, que será atendida en los plazos
        señalados en la sección «Atención al cliente, peticiones, quejas y
        reclamos».
      </>,
      <>
        El consumidor puede acudir a la{' '}
        <a
          href="https://www.sic.gov.co"
          target="_blank"
          rel="noopener noreferrer"
        >
          Superintendencia de Industria y Comercio
        </a>
        , en ejercicio de sus funciones administrativas y jurisdiccionales, o a
        los jueces competentes de la República de Colombia, conforme a la ley.
        Nada en estos Términos obliga al consumidor a acudir a la justicia
        arbitral.
      </>,
    ],
  },
]

export default function TermsPage() {
  return (
    <LegalDocument
      documentKey="terminos"
      title="Términos y Condiciones de Uso"
      intro={
        <>
          <p>
            Los presentes Términos y Condiciones de Uso (los «Términos») regulan
            el acceso y el uso de {B} (la «Plataforma»), operada por{' '}
            {COMPANY.legalName}, identificada con NIT {COMPANY.nit} y con
            domicilio en {COMPANY.address} (en adelante, «{B}»).
          </p>
          <p>
            Estos Términos constituyen un acuerdo vinculante entre {B} y toda
            persona que acceda a la Plataforma o la utilice. Al registrarse,
            iniciar sesión, marcar la casilla de aceptación o realizar un
            Pedido, el Usuario declara que ha leído, comprendido y aceptado
            íntegramente estos Términos y los documentos que forman parte de
            ellos. Quien no esté de acuerdo debe abstenerse de usar la
            Plataforma.
          </p>
          <p>
            <strong>
              Ninguna disposición de estos Términos limita ni excluye los
              derechos que la Ley 1480 de 2011 (Estatuto del Consumidor)
              reconoce al consumidor, los cuales son de orden público e
              irrenunciables.
            </strong>{' '}
            Cualquier estipulación en contrario será ineficaz de pleno derecho.
          </p>
        </>
      }
      sections={numberClauses(SECTIONS)}
    />
  )
}
