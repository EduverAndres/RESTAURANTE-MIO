import type { Metadata } from 'next'
import Link from 'next/link'
import { CookiePreferencesButton } from '@/components/legal/cookie-banner'
import { LegalDocument } from '@/components/legal/legal-document'
import { COMPANY } from '@/lib/legal/company'
import { ESSENTIAL_STORAGE } from '@/lib/legal/cookies'

export const metadata: Metadata = {
  title: 'Política de Cookies',
  description: `Qué cookies y almacenamiento local usa ${COMPANY.brand} y cómo controlarlos.`,
}

const B = COMPANY.brand

export default function CookiesPage() {
  return (
    <LegalDocument
      documentKey="cookies"
      title="Política de Cookies"
      intro={
        <>
          <p>
            Las cookies son pequeños archivos que un sitio guarda en tu
            navegador. El almacenamiento local cumple una función parecida. En{' '}
            {B} los usamos lo mínimo posible y{' '}
            <strong>no usamos cookies de publicidad ni de rastreo</strong>.
          </p>
          <p>
            <CookiePreferencesButton className="text-primary-on-tint font-medium underline underline-offset-2" />
          </p>
        </>
      }
      sections={[
        {
          id: 'tipos',
          title: 'Qué tipos usamos',
          content: (
            <>
              <h3>Esenciales (siempre activas)</h3>
              <p>
                Permiten iniciar sesión, mantener tu carrito y tu dirección,
                proteger la Plataforma y recordar las preferencias que tú eliges
                (tema, accesibilidad). Sin ellas el servicio que pides no
                funciona, por eso no requieren consentimiento, pero te las
                contamos todas.
              </p>
              <h3>Analítica (opcional, hoy no se usa)</h3>
              <p>
                Servirían para medir de forma agregada cómo se usa la
                Plataforma. Actualmente no instalamos ninguna. Si en el futuro
                lo hacemos, solo se activarán si das tu permiso en el panel de
                preferencias.
              </p>
              <h3>Publicidad (opcional, hoy no se usa)</h3>
              <p>
                Servirían para mostrarte ofertas relevantes. Actualmente no
                instalamos ninguna y, de hacerlo, también requerirían tu permiso
                previo.
              </p>
            </>
          ),
        },
        {
          id: 'inventario',
          title: 'Lo que guardamos en tu navegador',
          content: (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                <caption className="sr-only">
                  Cookies y almacenamiento usados por la Plataforma
                </caption>
                <thead>
                  <tr className="border-border border-b">
                    <th scope="col" className="px-1 py-2 font-semibold">
                      Nombre
                    </th>
                    <th scope="col" className="px-1 py-2 font-semibold">
                      Tipo
                    </th>
                    <th scope="col" className="px-1 py-2 font-semibold">
                      Finalidad
                    </th>
                    <th scope="col" className="px-1 py-2 font-semibold">
                      Duración
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ESSENTIAL_STORAGE.map((entry) => (
                    <tr
                      key={entry.name}
                      className="border-border/60 border-b align-top"
                    >
                      <td className="px-1 py-2 font-mono text-xs break-all">
                        {entry.name}
                      </td>
                      <td className="text-muted-foreground px-1 py-2 text-xs">
                        {entry.kind}
                      </td>
                      <td className="text-muted-foreground px-1 py-2">
                        {entry.purpose}
                      </td>
                      <td className="text-muted-foreground px-1 py-2 whitespace-nowrap">
                        {entry.duration}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ),
        },
        {
          id: 'terceros',
          title: 'Servicios de terceros',
          content: (
            <p>
              Cuando eliges iniciar sesión con Google o pagas en la página de
              una pasarela (Wompi, Mercado Pago), esos servicios pueden usar sus
              propias cookies en sus dominios, por ejemplo para prevenir fraude.
              Se rigen por sus propias políticas. Los mapas cargan imágenes de
              OpenStreetMap, que recibe tu dirección IP pero no instala cookies
              en nuestro sitio.
            </p>
          ),
        },
        {
          id: 'control',
          title: 'Cómo controlarlas',
          content: (
            <>
              <p>
                Puedes cambiar tus preferencias cuando quieras desde el enlace
                «Preferencias de cookies» al pie de cada página. También puedes
                borrar o bloquear cookies desde la configuración de tu
                navegador; si bloqueas las esenciales, no podrás iniciar sesión
                ni hacer pedidos.
              </p>
              <p>
                Los datos asociados a estas cookies se tratan conforme a nuestra{' '}
                <Link href="/privacidad">
                  Política de Tratamiento de Datos Personales
                </Link>
                .
              </p>
            </>
          ),
        },
      ]}
    />
  )
}
