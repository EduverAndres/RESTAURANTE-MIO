-- Comprobaciones ANTES de aplicar las migraciones de Cerquita 2.0 en
-- producción. Solo lectura: no cambia nada.
--
-- Uso (desde tu PC o la instancia, con la cadena de conexión de producción):
--   psql "$SUPABASE_DB_URL" -f scripts/preflight-cerquita-2.sql
-- o pégalo en Supabase → SQL Editor.

-- 1. Migraciones ya aplicadas. La última debería ser 20261120000100.
select version
from supabase_migrations.schema_migrations
order by version desc
limit 5;

-- 2. Deudas de comercios que se ARRASTRARÁN a su próxima liquidación
--    (20261124000100). Marca como pagadas las que ya se saldaron por fuera
--    ANTES de migrar, o se descontarán otra vez.
select s.name as tienda, p.period_start, p.period_end, p.net as saldo
from public.payouts p
join public.stores s on s.id = p.store_id
where p.status = 'pending' and p.net < 0
order by s.name, p.period_start;

-- 3. Domiciliarios que dejarán de ver la bolsa hasta completar su perfil y
--    que un admin lo apruebe (20261124000200). Avísales antes.
select count(*) as domiciliarios_registrados
from public.profiles
where role = 'courier';

-- 4. Pedidos en efectivo en curso con domiciliario: el libro empieza vacío
--    (20261124000300), así que estos se concilian a mano.
select o.short_code, o.status, o.total, o.created_at
from public.orders o
where o.payment_method = 'cash'
  and o.courier_id is not null
  and o.status in ('ready', 'picked_up', 'delivered')
  and o.created_at > now() - interval '30 days'
order by o.created_at desc;

-- 5. SEGURIDAD: cuentas de prueba del seed. Su contraseña está publicada en
--    el repositorio (e2e/fixtures.ts). En producción NO deben existir: si
--    aparecen, bórralas o cámbiales la contraseña desde Supabase → Auth.
select u.email, p.role, u.created_at
from auth.users u
left join public.profiles p on p.id = u.id
where u.email like '%@tienda.app'
order by p.role, u.email;
