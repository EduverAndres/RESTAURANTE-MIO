-- Reverts supabase/migrations/20261124000700_company_rpcs.sql.
--
-- Not picked up by `supabase db push` (this folder is not a migrations
-- folder). Run by hand after 0800's rollback, then forget the migration:
--   psql "$SUPABASE_DB_URL" -f supabase/rollbacks/20261124000700_company_rpcs.down.sql
--   psql "$SUPABASE_DB_URL" -c "delete from supabase_migrations.schema_migrations where version = '20261124000700'"
--
-- Only functions go; companies, members and invitations stay in their tables
-- (0600's rollback removes those). The /empresa panel stops working until it
-- is re-applied.

set lock_timeout = '3s';

drop function if exists public.company_orders(uuid, date);
drop function if exists public.company_team(uuid);
drop function if exists public.company_month_summary(uuid, date);
drop function if exists public.my_corporate_budget();
drop function if exists public.update_company_billing(uuid, text, text, text, text, text);
drop function if exists public.set_company_member(uuid, text, numeric, numeric, boolean);
drop function if exists public.revoke_company_invitation(uuid);
drop function if exists public.create_company_invitation(uuid, text, text, numeric, numeric, integer, integer);
drop function if exists public.accept_company_invitation(text);
drop function if exists public.peek_company_invitation(text);
drop function if exists public.register_company(text, text, text, integer, text, text, text, text, text, text);

reset lock_timeout;
