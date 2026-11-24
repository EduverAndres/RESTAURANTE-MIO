import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalDocument } from '@/components/legal/legal-document'
import { COMPANY_TERMS_VERSION } from '@/lib/companies/vocabulary'
import { COMPANY } from '@/lib/legal/company'

export const metadata: Metadata = {
  title: 'Términos para Empresas',
  description: `Condiciones de la cuenta de empresa de ${COMPANY.brand}: equipo, presupuestos, crédito mensual y facturación.`,
}

const B = COMPANY.brand

export default function CompanyTermsPage() {
  return (
    <LegalDocument
      documentKey="empresas"
      title="Términos para Empresas"
      version={COMPANY_TERMS_VERSION}
      updatedAt="24 de noviembre de 2026"
      intro={
        <p>
          Estos términos se suman a los{' '}
          <Link href="/terminos">Términos y Condiciones</Link> generales y
          aplican a la persona jurídica o natural con NIT que abre una cuenta de
          empresa en {B} (la «Empresa») y a las personas que ella autoriza para
          pedir con su cuenta (los «Usuarios autorizados»). Quien registra la
          cuenta declara que puede obligar a la Empresa. Al registrarla, o al
          unirse a ella, se aceptan estos términos.
        </p>
      }
      sections={[
        {
          id: 'registro',
          title: 'Registro y aprobación',
          content: (
            <ul>
              <li>
                La Empresa suministra su razón social, NIT con dígito de
                verificación y datos de facturación veraces, y los mantiene
                actualizados. {B} puede verificarlos y pedir documentos (por
                ejemplo, el RUT o el certificado de existencia y
                representación).
              </li>
              <li>
                {COMPANY.legalName} decide si aprueba la cuenta y fija un cupo
                de crédito, un plazo de pago y un tope de propina. Puede
                modificarlos informándolo a la Empresa. Mientras la cuenta está
                en revisión no se puede pagar con ella.
              </li>
            </ul>
          ),
        },
        {
          id: 'usuarios',
          title: 'Usuarios autorizados',
          content: (
            <ul>
              <li>
                Los administradores de la Empresa invitan Usuarios autorizados
                con enlaces y les asignan, si quieren, un presupuesto mensual y
                un tope por pedido. Los enlaces son confidenciales: quien los
                tenga puede unirse mientras estén vigentes.
              </li>
              <li>
                La Empresa responde por los pedidos que sus Usuarios autorizados
                paguen con la cuenta dentro de esos límites, y debe retirar de
                inmediato a quien deje de estar autorizado.
              </li>
              <li>Una persona pertenece a una sola empresa a la vez.</li>
            </ul>
          ),
        },
        {
          id: 'pedidos',
          title: 'Pedidos, precios y autorización',
          content: (
            <ul>
              <li>
                Cada pedido es una compra al comercio que lo vende, al precio de
                su carta, más el domicilio y la propina que la Empresa cubra. No
                hay recargo por pagar con la cuenta de empresa.
              </li>
              <li>
                {B} autoriza cada pedido contra el cupo de la Empresa, el
                presupuesto y el tope del Usuario y el tope de propina, y lo
                rechaza si alguno no alcanza o si la cuenta está suspendida o en
                mora.
              </li>
              <li>
                Los cupones de los comercios aplican. Los premios de sellos y
                los créditos por invitación son personales y no se usan en
                pedidos pagados por la Empresa.
              </li>
            </ul>
          ),
        },
        {
          id: 'facturacion',
          title: 'Facturación',
          content: (
            <>
              <p>
                Cada comercio expide la factura electrónica de venta de sus
                pedidos a nombre de la razón social y el NIT de la Empresa, con
                los datos de facturación registrados. {B} paga a los comercios
                esos pedidos en sus liquidaciones y entrega a la Empresa un
                estado de cuenta mensual que los reúne; el estado de cuenta no
                reemplaza las facturas de los comercios.
              </p>
            </>
          ),
        },
        {
          id: 'pago',
          title: 'Estado de cuenta y pago',
          content: (
            <ul>
              <li>
                Al cerrar cada mes, {B} emite un estado de cuenta con los
                pedidos entregados en el mes (y los entregados después del
                cierre de un mes anterior que aún no se habían cobrado), y lo
                pone a disposición en el panel de la Empresa.
              </li>
              <li>
                La Empresa lo paga dentro del plazo aprobado, contado desde su
                emisión, por el medio que {B} indique y con la referencia del
                estado de cuenta.
              </li>
              <li>
                Las observaciones a un estado de cuenta se presentan dentro de
                los diez (10) días hábiles siguientes a su emisión; pasado ese
                término se entiende aceptado, sin perjuicio de los reembolsos
                que procedan.
              </li>
            </ul>
          ),
        },
        {
          id: 'mora',
          title: 'Mora y suspensión',
          content: (
            <p>
              Si un estado de cuenta no se paga a su vencimiento, la cuenta se
              pausa automáticamente y nadie puede pagar con ella hasta que se
              pague. {B} puede además suspenderla por incumplimiento, fraude o
              uso indebido, y adelantar las gestiones de cobro de lo adeudado.
              Los pedidos ya aceptados siguen su curso.
            </p>
          ),
        },
        {
          id: 'cancelaciones',
          title: 'Cancelaciones y reembolsos',
          content: (
            <ul>
              <li>
                Un pedido cancelado antes de entregarse no se cobra y libera el
                cupo y el presupuesto de inmediato.
              </li>
              <li>
                Si un pedido entregado se reembolsa, su valor se abona en el
                siguiente estado de cuenta. Los reclamos por la calidad del
                producto se atienden con el comercio que lo vendió, como dicen
                los Términos y Condiciones generales.
              </li>
            </ul>
          ),
        },
        {
          id: 'datos',
          title: 'Datos personales',
          content: (
            <p>
              Los administradores de la Empresa ven, de los pedidos pagados con
              su cuenta, la fecha, el comercio, el valor, el Usuario que lo hizo
              y el motivo o centro de costo, y del equipo, el nombre y el correo
              de cada Usuario. Cada parte trata esos datos solo para administrar
              la cuenta y su facturación, conforme a la Ley 1581 de 2012 y a la{' '}
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
              La Empresa puede cerrar su cuenta en cualquier momento, después de
              pagar los estados de cuenta pendientes y los pedidos ya
              autorizados. {B} puede terminarla informándolo con anticipación, o
              de inmediato por incumplimiento, fraude o riesgo para los
              usuarios, sin perjuicio de las obligaciones pendientes.
            </p>
          ),
        },
      ]}
    />
  )
}
