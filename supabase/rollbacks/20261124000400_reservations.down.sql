-- Reverts supabase/migrations/20261124000400_reservations.sql.
--
-- Not picked up by `supabase db push` (this folder is not a migrations
-- folder). Run by hand, then forget the migration so it can be re-applied:
--   psql "$SUPABASE_DB_URL" -f supabase/rollbacks/20261124000400_reservations.down.sql
--   psql "$SUPABASE_DB_URL" -c "delete from supabase_migrations.schema_migrations where version = '20261124000400'"
--
-- Every reservation and every store's reservation settings are deleted with
-- their tables: export them first if they matter.

set lock_timeout = '3s';

alter publication supabase_realtime drop table public.reservations;
drop function if exists public.create_reservation(uuid, uuid, timestamptz, date, integer, text, text, text, text, integer);
drop trigger if exists reservations_guard_update on public.reservations;
drop function if exists public.guard_reservation_update();
drop table if exists public.reservations;
drop table if exists public.reservation_settings;

reset lock_timeout;
