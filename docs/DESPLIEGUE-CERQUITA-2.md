# Despliegue de Cerquita 2.0 en Lightsail

Guía para llevar Cerquita 2.0 a producción. Sigue el flujo de siempre:
`develop` → PR a `main` → `aws`, y en la instancia
`scripts/deploy-lightsail.sh`.

Llega en dos entregas, porque las migraciones deben aplicarse en orden:

| Entrega | Contenido                                                                                                                                     | Migraciones     |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 1       | Términos nuevos, que el dinero entre (arrastre de deudas, domiciliarios aprobados, libro y tope de efectivo), reservas de mesa y la web nueva | `0100` a `0400` |
| 2       | Cuentas de empresa y anuncios pagados                                                                                                         | `0500` a `0900` |

## Qué cambia en la base de datos

| Migración                                             | Qué hace                                                                          | Efecto visible al aplicarla                                                                    |
| ----------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `20261124000100_payout_carry`                         | Arrastra deudas de comercios y les paga domicilio y propina cuando entregan ellos | Las liquidaciones pendientes en negativo se descontarán en la próxima                          |
| `20261124000200_courier_profiles`                     | Perfil y aprobación de domiciliarios                                              | **Los domiciliarios actuales dejan de ver la bolsa** hasta completar su perfil y ser aprobados |
| `20261124000300_courier_ledger`                       | Libro de efectivo y ganancias, tope de deuda, liquidación de domiciliarios        | El libro empieza vacío                                                                         |
| `20261124000400_reservations`                         | Reservas de mesa                                                                  | Nada hasta que una tienda con plan Mediano o VIP las active                                    |
| `20261124000500_payment_method_corporate` (entrega 2) | Valor `corporate` en el enum de pagos                                             | Irreversible (Postgres no quita valores de un enum)                                            |
| `20261124000600` a `0800` (entrega 2)                 | Cuentas de empresa                                                                | Nada mientras `CORPORATE_ACCOUNTS_ENABLED` no esté en `true`                                   |
| `20261124000900_ad_campaigns` (entrega 2)             | Anuncios pagados y `generate_payouts` v4                                          | Nada hasta aprobar la primera campaña                                                          |

Todas tienen su rollback en `supabase/rollbacks/`.

## 1. Antes de desplegar (una sola vez)

1. **Respaldo de la base.** En Supabase → Database → Backups, confirma que hay
   un respaldo reciente, o descarga uno:
   ```bash
   pg_dump "$SUPABASE_DB_URL" -Fc -f respaldo-antes-cerquita-2.dump
   ```
2. **Comprobaciones previas** (solo lectura):
   ```bash
   psql "$SUPABASE_DB_URL" -f scripts/preflight-cerquita-2.sql
   ```
   - Marca como pagadas las liquidaciones negativas que ya se saldaron por
     fuera; si no, se descontarán otra vez.
   - Si aparecen cuentas `@tienda.app`, **bórralas o cámbiales la contraseña**:
     son las del seed y su contraseña está publicada en el repositorio.
3. **Avisa a los domiciliarios** que deben completar su perfil en
   `/courier/perfil` (vehículo, placa, cédula, vencimiento de licencia y SOAT)
   y esperar la aprobación.
4. **Revisa el `.env.local` de la instancia** (se lee al compilar):
   - `NEXT_PUBLIC_PRIVACY_EMAIL` debe ser un correo (hoy muestra un nombre).
   - `NEXT_PUBLIC_LEGAL_NIT` vacío mientras no haya NIT (la web dice
     "En trámite" con tilde y muestra el aviso).
   - `NEXT_PUBLIC_LEGAL_ADDRESS` con calle y número (Ley 1480, art. 50).
   - `NEXT_PUBLIC_LEGAL_PHONE` con el número correcto.
   - (Entrega 2) `CORPORATE_ACCOUNTS_ENABLED=false` hasta la revisión contable
     y legal del crédito corporativo.
   - `TZ=America/Bogota`.

## 2. Desplegar

En tu PC, una vez que el PR de `develop` a `main` está fusionado con el CI en
verde, alinea `aws`:

```bash
git checkout aws
git pull --ff-only origin aws
git merge --ff-only origin/main
git push origin aws
```

En la instancia (consola SSH de Lightsail):

```bash
cd ~/RESTAURANTE-MIO          # la carpeta del repo en la instancia
git status                    # debe estar limpio
git checkout aws
bash scripts/deploy-lightsail.sh
```

El script pregunta antes de cada paso:

- **"¿Reviso y aplico las migraciones pendientes?"** → responde `s` solo
  después del respaldo y las comprobaciones. Aplica las migraciones de la
  tabla, en orden, contra `SUPABASE_DB_URL`.
- Compila, arma la carpeta standalone, reinicia el servicio y comprueba
  `/api/health`.

Si en la instancia no está `SUPABASE_DB_URL`, aplica las migraciones desde tu
PC antes de correr el script (con la cadena de producción en `.env.local`):

```bash
npm run db:push
```

**No ejecutes `npm run db:seed` en producción**: crea las cuentas de prueba.

## 3. Después de desplegar

1. `curl -s https://<tu-dominio>/api/health` → `{"status":"ok"}`.
2. Entra como admin:
   - `/admin/domiciliarios`: aprueba los perfiles completos.
   - (Entrega 2) `/admin/publicidad`: revisa los precios por día de cada
     ubicación.
3. Todos los usuarios verán una vez la pantalla para aceptar los términos
   nuevos (versión 2026-11-23). Es esperado.
4. Si una página nueva responde con error de tabla inexistente, recarga el
   esquema de PostgREST en Supabase → SQL Editor:
   ```sql
   notify pgrst, 'reload schema';
   ```

## Volver atrás

- **Código**: en la instancia, `git checkout <commit-anterior>` y
  `bash scripts/deploy-lightsail.sh` (responde `N` a las migraciones).
- **Base de datos**: ejecuta los `.down.sql` de `supabase/rollbacks/` en orden
  inverso (de la más nueva a `0100`) y borra cada versión de
  `supabase_migrations.schema_migrations`, como explica cada archivo. Se
  pierden los datos nuevos (reservas, libro de domiciliarios y, en la entrega 2,
  empresas y campañas):
  expórtalos antes.
