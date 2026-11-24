-- Reverts supabase/migrations/20261124000800_corporate_charges.sql.
--
-- Not picked up by `supabase db push` (this folder is not a migrations
-- folder). Run by hand, then forget the migration so it can be re-applied:
--   psql "$SUPABASE_DB_URL" -f supabase/rollbacks/20261124000800_corporate_charges.down.sql
--   psql "$SUPABASE_DB_URL" -c "delete from supabase_migrations.schema_migrations where version = '20261124000800'"
--
-- Only functions go: orders already authorised stay paid, and statements
-- already generated stay in their tables (0600's rollback removes those).
-- While this is rolled back no corporate charge can be authorised, so turn
-- CORPORATE_ACCOUNTS_ENABLED off first.

set lock_timeout = '3s';

drop function if exists public.void_company_statement(uuid, text);
drop function if exists public.refresh_overdue_company_statements();
drop function if exists public.generate_company_statements(date);
drop function if exists public.authorize_corporate_payment(uuid);

reset lock_timeout;
