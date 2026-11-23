-- Reverts supabase/migrations/20261124000600_companies.sql.
--
-- Not picked up by `supabase db push` (this folder is not a migrations
-- folder). Run by hand after the rollbacks of 0800 and 0700, then forget the
-- migration so it can be re-applied:
--   psql "$SUPABASE_DB_URL" -f supabase/rollbacks/20261124000600_companies.down.sql
--   psql "$SUPABASE_DB_URL" -c "delete from supabase_migrations.schema_migrations where version = '20261124000600'"
--
-- DESTRUCTIVE: every company, member, invitation, statement and billing
-- snapshot is deleted with its table, and orders lose who they were charged
-- to. Export them first if they matter (statements are accounting records).
-- Orders paid with a company account keep `payment_method = 'corporate'`
-- (see 0500's rollback): they are still settled like online payments.

set lock_timeout = '3s';

-- Consent evidence is append-only and kept for the legal retention period,
-- so rows written with the company sources are NOT deleted: the old check
-- comes back `not valid`, which refuses new rows with those sources and
-- leaves the existing ones alone.
alter table public.legal_consents drop constraint if exists legal_consents_source_check;
alter table public.legal_consents
  add constraint legal_consents_source_check
  check (source in ('register', 'login-password', 'login-sms', 'login-google', 'login-microsoft', 'gate'))
  not valid;

-- protect_order_columns as 20261119000100_lock_order_writes.sql left it.
create or replace function public.protect_order_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;

  if new.store_id is distinct from old.store_id
     or new.customer_id is distinct from old.customer_id
     or new.address_id is distinct from old.address_id
     or new.type is distinct from old.type
     or new.table_number is distinct from old.table_number
     or new.short_code is distinct from old.short_code
     or new.subtotal is distinct from old.subtotal
     or new.delivery_fee is distinct from old.delivery_fee
     or new.platform_fee is distinct from old.platform_fee
     or new.tip is distinct from old.tip
     or new.total is distinct from old.total
     or new.payment_method is distinct from old.payment_method
     or new.payment_status is distinct from old.payment_status
     or new.payment_ref is distinct from old.payment_ref
     or new.merchant_discount is distinct from old.merchant_discount
     or new.platform_discount is distinct from old.platform_discount
     or new.coupon_id is distinct from old.coupon_id
     or new.loyalty_redeemed is distinct from old.loyalty_redeemed
     or new.credit_id is distinct from old.credit_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Only the server can change the price, payment or ownership of an order'
      using errcode = 'insufficient_privilege';
  end if;

  if new.courier_id is distinct from old.courier_id
     and not (old.courier_id is null and new.courier_id = auth.uid()) then
    raise exception 'Only a courier can assign an order, and only to themselves'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop table if exists public.company_statement_lines;
drop table if exists public.company_statements;
drop table if exists public.order_corporate_billing;

alter table public.orders drop constraint if exists orders_corporate_company;
drop index if exists public.orders_company_member_period_idx;
drop index if exists public.orders_company_period_idx;
alter table public.orders
  drop column if exists corporate_reference,
  drop column if exists corporate_period,
  drop column if exists company_member_id,
  drop column if exists company_id;

drop function if exists public.company_is_overdue(uuid);
drop function if exists public.company_member_spent(uuid, date);
drop function if exists public.company_credit_used(uuid);

drop table if exists public.company_members;
drop table if exists public.company_invitations;
drop table if exists public.companies;

-- After the tables: their policies and check constraints use these.
drop function if exists public.is_company_admin(uuid);
drop function if exists public.is_company_member(uuid);
drop function if exists public.bogota_month_start();
drop function if exists public.nit_check_digit(text);

reset lock_timeout;
