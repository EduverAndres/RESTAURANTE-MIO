-- Reverts supabase/migrations/20261125000100_notifications.sql.
--
-- Not picked up by `supabase db push` (this folder is not a migrations
-- folder). Run by hand, then forget the migration so it can be re-applied:
--   psql "$SUPABASE_DB_URL" -f supabase/rollbacks/20261125000100_notifications.down.sql
--   psql "$SUPABASE_DB_URL" -c "delete from supabase_migrations.schema_migrations where version = '20261125000100'"
--
-- Every notification is deleted with the table. Push notifications keep
-- working: they never depended on it.

set lock_timeout = '3s';

alter publication supabase_realtime drop table public.notifications;
drop table if exists public.notifications;

reset lock_timeout;
