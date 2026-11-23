# Cerquita — especificación de producto

Este documento es la referencia de qué es Cerquita, para quién y cómo gana
dinero. Cualquier cambio de producto debe poder explicarse desde aquí.

## Qué es

Cerquita es la app de Barranquilla para **pedir y reservar** en los
restaurantes y negocios favoritos del barrio. Debe sentirse tan fácil como las
apps grandes, o más, y ser justa con el comercio.

## Públicos y promesa

| Público                      | Qué obtiene                                                                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Clientes**                 | Pedir a domicilio, para recoger o desde la mesa, y reservar mesa en segundos. Precio de la carta sin recargos ocultos, seguimiento en vivo, favoritos y repetir pedido con un toque. |
| **Empresas**                 | Cuenta corporativa: empleados invitados, presupuesto por persona y por pedido, un solo estado de cuenta mensual a crédito y datos de facturación con NIT.                            |
| **Restaurantes y comercios** | Canal propio con su marca; pedidos y **reservas** en un panel en tiempo real; clientes propios, fidelidad, pedidos de empresas y **anuncios destacados** opcionales; planes claros.  |
| **Domiciliarios**            | Registro, aprobación con documentos, bolsa de entregas, ganancias claras (valor del domicilio + 100 % de la propina) y liquidación periódica.                                        |

## Experiencia

- **Dinámica, con movimiento con propósito:** demo animada de un pedido en
  vivo, selector por público, contadores, carruseles y revelado al hacer
  scroll.
- **Rápida:** el titular principal no tiene animación de entrada (es el LCP).
- **Accesible:** WCAG 2.1 AA; respeta "reducir movimiento" del sistema **y** de
  la app; todo el contenido es visible sin JavaScript.
- **Publicidad veraz (Ley 1480):** nada de cifras ni testimonios inventados; la
  prueba social solo aparece con datos reales; todo anuncio se marca
  "Patrocinado".

## Modelo de negocio

| Fuente              | Cómo se cobra                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------ |
| Comisión por pedido | % del subtotal (0 % en mesa y para fundadores), descontado en la liquidación del comercio. |
| Pago en línea       | 5 % adicional cuando el pedido no es en efectivo, incluidos los corporativos.              |
| Planes              | Mensualidad prorrateada por día en la liquidación. Reservas incluidas en Mediano y VIP.    |
| Anuncios destacados | Precio por día y ubicación, descontado en la liquidación.                                  |

Reglas que protegen el ingreso:

- **Toda deuda se arrastra** a la siguiente liquidación hasta cobrarse.
- El efectivo que recoge un domiciliario se concilia en **su libro**, con tope
  de deuda: por encima del tope no puede tomar pedidos en efectivo.
- Los reembolsos de pedidos en efectivo solo los registra el equipo de
  Cerquita.
- Las empresas compran a crédito con cupo, plazo y bloqueo automático por mora.

## Hoja de ruta (Cerquita 2.0)

1. **Que el dinero entre:** reembolsos en efectivo solo por admin, arrastre de
   saldos, envío y propina al comercio que entrega, aprobación de
   domiciliarios, libro y liquidación de domiciliarios con tope de efectivo.
2. **Reservas de mesa:** el cliente reserva fecha, hora y personas; el
   restaurante confirma, rechaza y marca llegada o no llegada desde su panel.
3. **Marketing y movimiento:** home renovada, páginas para cada público
   (`/reservas`, `/repartidores`, `/para-restaurantes`, `/empresas`),
   navegación y footer por público.
4. **Cuentas corporativas:** registro de empresa, aprobación con cupo, equipo
   con presupuestos, pago "Cuenta de empresa" en el checkout, estados de
   cuenta mensuales.
5. **Anuncios pagados:** campañas por ubicación (home, categoría, búsqueda),
   aprobación, cobro en la liquidación y medición de clics.

## Calidad

Cada cambio llega con tests (módulos puros con TDD, migraciones con rollback y
tests de migración o de deriva SQL↔TS), tipos, lint y verificación visual.
Nada se aplica a la base de datos de producción sin aprobación explícita.
