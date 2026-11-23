-- Reverts supabase/migrations/20261124000300_courier_ledger.sql.
--
-- Not picked up by `supabase db push` (this folder is not a migrations
-- folder). Run by hand, then forget the migration so it can be re-applied:
--   psql "$SUPABASE_DB_URL" -f supabase/rollbacks/20261124000300_courier_ledger.down.sql
--   psql "$SUPABASE_DB_URL" -c "delete from supabase_migrations.schema_migrations where version = '20261124000300'"
--
-- The courier ledger and courier payouts are deleted with their tables:
-- export them first, they are money owed in both directions.

set lock_timeout = '3s';

drop trigger if exists orders_guard_courier_cash_cap on public.orders;
drop trigger if exists orders_record_courier_delivery on public.orders;
drop function if exists public.generate_courier_payouts(date, date);
drop function if exists public.guard_courier_cash_cap();
drop function if exists public.my_courier_cash_status();
drop function if exists public.courier_cash_in_progress(uuid);
drop function if exists public.courier_cash_balance(uuid);
drop function if exists public.record_courier_delivery();
drop table if exists public.courier_ledger;
drop table if exists public.courier_payouts;
alter table public.platform_settings
  drop column if exists courier_cash_debt_cap;

reset lock_timeout;
