-- Orders, their items and store ratings are money: only trusted code writes
-- what they cost and whether they were paid.
--
-- What was possible before this migration, straight against the REST API
-- with the public key and a normal session (reproduced on a local stack):
--   * a customer inserted an order already marked `payment_status = 'paid'`
--     and its items at `unit_price = 1`;
--   * an anonymous visitor inserted `type = 'table'` orders into any store
--     without the table's QR token (and without its rate limit);
--   * a merchant flipped a cash order to `paid`, inflating the next payout;
--   * a merchant set its own `rating_avg` / `rating_count`.
-- The server actions validated all of this, but nothing forced a caller to
-- go through them.
--
-- The rule now: direct API writes (the `anon` and `authenticated` roles that
-- PostgREST runs as) can no longer create orders or touch items, and on an
-- existing order may only move its status (RLS already says who may do that)
-- and let a courier assign themselves. Everything else is written by the
-- server with the service role, or by SECURITY DEFINER functions such as
-- record_refund and recalc_order_subtotal; both run as roles other than
-- anon/authenticated, so the checks below never get in their way.

set lock_timeout = '3s';

-- ---------------------------------------------------------------------------
-- 1. Creating orders and items is server-only
-- ---------------------------------------------------------------------------
-- placeOrder / placeTableOrder already authenticate the caller, check the
-- address or the QR token, rate-limit and price everything on the server;
-- they now insert with the service role instead of the caller's session.
drop policy if exists "orders: customer insert own" on public.orders;
drop policy if exists "orders: anon insert table order" on public.orders;
drop policy if exists "order_items: insert into editable order" on public.order_items;
drop policy if exists "order_items: update in editable order" on public.order_items;
drop policy if exists "order_items: delete from editable order" on public.order_items;
-- Kept: "order_items: admin full access" and "read when order visible".

-- ---------------------------------------------------------------------------
-- 2. On an existing order, a session may change the status, nothing that
--    sets a price, a payment or who the order belongs to
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER on purpose: `current_user` is then the role that ran the
-- statement — `authenticated`/`anon` for a direct API call, the function
-- owner inside a SECURITY DEFINER function, `service_role` for the server.
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

  -- The courier column only ever goes from empty to the caller: a courier
  -- claiming the order. Nobody hands an order to someone else this way.
  if new.courier_id is distinct from old.courier_id
     and not (old.courier_id is null and new.courier_id = auth.uid()) then
    raise exception 'Only a courier can assign an order, and only to themselves'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_protect_columns on public.orders;
create trigger orders_protect_columns
  before update on public.orders
  for each row execute function public.protect_order_columns();

comment on function public.protect_order_columns() is
  'Direct API updates of orders may change status (per RLS) and let a courier claim it; prices, payment and ownership are server-only.';

-- ---------------------------------------------------------------------------
-- 3. A store's rating comes from its reviews, never from its owner
-- ---------------------------------------------------------------------------
-- The reviews trigger recomputes the rating inside a SECURITY DEFINER
-- function, so it is unaffected; a direct PATCH from the owner is refused.
create or replace function public.protect_store_rating()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if coalesce(new.rating_avg, 0) <> 0 or coalesce(new.rating_count, 0) <> 0 then
      raise exception 'Ratings come from reviews'
        using errcode = 'insufficient_privilege';
    end if;
  elsif new.rating_avg is distinct from old.rating_avg
     or new.rating_count is distinct from old.rating_count then
    raise exception 'Ratings come from reviews'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists stores_protect_rating on public.stores;
create trigger stores_protect_rating
  before insert or update on public.stores
  for each row execute function public.protect_store_rating();
