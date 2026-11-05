-- Merchant plans and the commission rule.
--
-- ---------------------------------------------------------------------------
-- The model
-- ---------------------------------------------------------------------------
-- No monthly fee is required to sell. Three plans (Normal, Mediano, VIP)
-- differ in features and in an optional monthly fee; the commission is the
-- same on all of them:
--
--   * 0% on a table order, `commission_pct` (6% by default) on delivery and
--     pickup;
--   * plus `online_payment_pct` (5% by default) whenever the customer pays
--     online, table orders included. The platform collects online payments
--     with its own gateway credentials and pays the gateway's cut; this is
--     what keeps an online order from costing the platform money;
--   * a founding business (`founder_until`) pays no base commission and gets
--     VIP until that date (inclusive, Bogotá calendar). The online share
--     still applies, for the same reason as above.
--
-- Prices live in `public.plans` and nowhere else: the payout transaction and
-- every screen read them from there.
--
-- ---------------------------------------------------------------------------
-- Mirrored rule
-- ---------------------------------------------------------------------------
-- The fee percentage is `platformFeePct` in lib/plans.ts. The block between
-- the `codegen:` markers below is emitted by lib/plans-sql.ts and compared
-- byte for byte by tests/plans-sql-drift.test.ts. Do not hand-edit it.
--
-- The founder waiver is dated by `orders.created_at`, so an order placed
-- during the founder period keeps its 0% when the trigger re-runs on a later
-- status update. `commission_pct` and `online_payment_pct` are still read
-- live, as before: changing a store's rate re-prices its open orders on their
-- next update, which is why rate changes are announced 30 days ahead
-- (terminos-aliados).

set lock_timeout = '3s';

-- ---------------------------------------------------------------------------
-- Plans
-- ---------------------------------------------------------------------------
create table public.plans (
  id text primary key,
  name text not null,
  monthly_fee numeric(12, 2) not null check (monthly_fee >= 0),
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.plans is
  'Merchant plans and their monthly fee. The only place prices are set; '
  'lib/plans.ts DEFAULT_PLAN_FEES only seeds and falls back.';

insert into public.plans (id, name, monthly_fee, position) values
  ('normal', 'Normal', 0, 1),
  ('mediano', 'Mediano', 49900, 2),
  ('vip', 'VIP', 129900, 3);

alter table public.plans enable row level security;

-- Prices are public: the owner landing shows them to anyone. Writes have no
-- policy, so only the service role (SQL editor, migrations) can change them.
create policy plans_select_all on public.plans
  for select using (true);

-- ---------------------------------------------------------------------------
-- Store columns
-- ---------------------------------------------------------------------------
alter table public.stores
  add column plan text not null default 'normal' references public.plans (id),
  add column founder_until date,
  add column online_payment_pct numeric not null default 5
    check (online_payment_pct >= 0 and online_payment_pct <= 30);

comment on column public.stores.plan is
  'Normal, Mediano or VIP. A store whose founder_until has not passed gets VIP features regardless.';
comment on column public.stores.founder_until is
  'Last day (inclusive, Bogotá) of the founder offer: no base commission, VIP, no plan fee.';
comment on column public.stores.online_payment_pct is
  'Added to the commission on every order not paid in cash; covers the gateway.';

-- ---------------------------------------------------------------------------
-- Only admins set what a store pays
-- ---------------------------------------------------------------------------
create or replace function public.protect_store_admin_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Requests without a user session (service role, migrations, seeds) and
  -- admins may manage these columns freely.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.commission_pct is distinct from 6
       or new.online_payment_pct is distinct from 5
       or new.plan is distinct from 'normal'
       or new.founder_until is not null
       or new.status is distinct from 'pending' then
      raise exception 'Only admins can set commission, plan or status'
        using errcode = 'insufficient_privilege';
    end if;
  elsif new.commission_pct is distinct from old.commission_pct
     or new.online_payment_pct is distinct from old.online_payment_pct
     or new.plan is distinct from old.plan
     or new.founder_until is distinct from old.founder_until
     or new.status is distinct from old.status then
    raise exception 'Only admins can change commission, plan or status'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- The commission on each order
-- ---------------------------------------------------------------------------
-- total = subtotal + delivery_fee + tip.
-- platform_fee is deducted from the merchant payout and therefore never added
-- to the customer total: the menu price is the price.
create or replace function public.compute_order_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s_commission numeric;
  s_online numeric;
  s_founder_until date;
begin
  select s.commission_pct, s.online_payment_pct, s.founder_until
    into s_commission, s_online, s_founder_until
  from public.stores s
  where s.id = new.store_id;

  new.platform_fee := round(coalesce(new.subtotal, 0) * (
-- codegen:begin(fee_pct)
(case
      when new.type = 'table' then 0
      when s_founder_until is not null
        and (coalesce(new.created_at, now()) at time zone 'America/Bogota')::date <= s_founder_until then 0
      else coalesce(s_commission, 0)
    end)
    + (case when new.payment_method = 'cash' then 0 else coalesce(s_online, 0) end)
-- codegen:end(fee_pct)
  ) / 100, 2);
  new.total := coalesce(new.subtotal, 0) + coalesce(new.delivery_fee, 0) + coalesce(new.tip, 0);
  return new;
end;
$$;

reset lock_timeout;
