-- Reverts supabase/migrations/20261124000200_courier_profiles.sql.
--
-- Not picked up by `supabase db push` (this folder is not a migrations
-- folder). Run by hand, then forget the migration so it can be re-applied:
--   psql "$SUPABASE_DB_URL" -f supabase/rollbacks/20261124000200_courier_profiles.down.sql
--   psql "$SUPABASE_DB_URL" -c "delete from supabase_migrations.schema_migrations where version = '20261124000200'"
--
-- The pool opens again to every user with the courier role, approved or not.
-- Courier profiles (documents, plates, reviews) are deleted with the table:
-- export them first if they matter.

set lock_timeout = '3s';

alter policy "orders: read as customer, owner or courier"
  on public.orders
  using (
    customer_id = auth.uid()
    or public.owns_store(store_id)
    or courier_id = auth.uid()
    or (
      courier_id is null
      and status = 'ready'
      and type = 'delivery'
      and public.user_role_of(auth.uid()) = 'courier'
    )
  );

alter policy "orders: courier claim or advance"
  on public.orders
  using (
    courier_id = auth.uid()
    or (
      courier_id is null
      and status = 'ready'
      and type = 'delivery'
      and public.user_role_of(auth.uid()) = 'courier'
    )
  )
  with check (courier_id = auth.uid());

drop function if exists public.is_active_courier();
drop table if exists public.courier_profiles;

reset lock_timeout;
