-- Discounts: store coupons, loyalty stamps and referral credits.
--
-- ---------------------------------------------------------------------------
-- Who pays what
-- ---------------------------------------------------------------------------
-- An order now carries two discounts, paid by different people:
--
--   * `merchant_discount`: a store coupon or a loyalty reward. The store pays
--     it: it lowers the store's sale, and the commission is charged on what
--     the customer really pays (subtotal - merchant_discount).
--   * `platform_discount`: a referral credit. Cerquita pays it: the store is
--     settled on its full sale, and the platform absorbs the difference.
--
--   total = subtotal - merchant_discount - platform_discount
--           + delivery_fee + tip
--
-- Settlement follows (generate_payouts, below):
--   gross          = subtotal - merchant_discount         (the store's sale)
--   cash_collected = subtotal - merchant_discount - platform_discount
--                    (what the customer handed the merchant in cash)
-- so on a cash order with a referral credit the platform owes the merchant
-- the credit it paid for, minus the commission.
--
-- ---------------------------------------------------------------------------
-- Only the server writes a discount
-- ---------------------------------------------------------------------------
-- Customers insert their own orders under RLS and owners may update their
-- store's orders, so without a guard either could write a discount: a
-- customer paying less, or a merchant zeroing its commission on cash sales.
-- `protect_order_discounts` refuses every discount column from any session;
-- the checkout action writes them with the service role after validating
-- the coupon, reward or credit.
--
-- Mirrored rules (lib/discounts.ts, lib/plans.ts, lib/payouts/compute.ts)
-- are emitted between `codegen:` markers and compared byte for byte by the
-- drift tests. Do not hand-edit those blocks.

set lock_timeout = '3s';

-- ---------------------------------------------------------------------------
-- Store coupons (paid by the store)
-- ---------------------------------------------------------------------------
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9]{3,20}$'),
  kind text not null check (kind in ('percent', 'fixed')),
  value numeric not null check (value > 0),
  min_order numeric not null default 0 check (min_order >= 0),
  starts_at date,
  ends_at date,
  max_uses integer check (max_uses is null or max_uses > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint coupons_store_code_key unique (store_id, code),
  constraint coupons_percent_range check (kind <> 'percent' or value <= 100),
  constraint coupons_dates check (starts_at is null or ends_at is null or starts_at <= ends_at)
);

alter table public.coupons enable row level security;

-- Codes are not listed to the public: the checkout validates one with the
-- service role. Owners manage their store's coupons; admins everything.
create policy "coupons: owner manages"
  on public.coupons for all to authenticated
  using (public.owns_store(store_id))
  with check (public.owns_store(store_id));

create policy "coupons: admin manages"
  on public.coupons for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Loyalty programs (paid by the store)
-- ---------------------------------------------------------------------------
-- A stamp is a delivered order of at least `min_order` (after the store's own
-- discount). Every `stamps_required` stamps the customer earns one reward,
-- worth up to `reward_value`, used as a discount on a later order. Balances
-- are counted from the customer's own orders, so there is no ledger to drift.
create table public.loyalty_programs (
  store_id uuid primary key references public.stores (id) on delete cascade,
  enabled boolean not null default false,
  stamps_required integer not null default 8 check (stamps_required between 3 and 20),
  min_order numeric not null default 0 check (min_order >= 0),
  reward_label text not null default '' check (char_length(reward_label) <= 60),
  reward_value numeric not null default 0 check (reward_value >= 0),
  updated_at timestamptz not null default now()
);

alter table public.loyalty_programs enable row level security;

-- Shown on the storefront, so readable by anyone.
create policy "loyalty: public read"
  on public.loyalty_programs for select
  using (true);

create policy "loyalty: owner manages"
  on public.loyalty_programs for all to authenticated
  using (public.owns_store(store_id))
  with check (public.owns_store(store_id));

-- ---------------------------------------------------------------------------
-- Referrals (paid by the platform, with a monthly cap)
-- ---------------------------------------------------------------------------
create table public.platform_settings (
  id boolean primary key default true check (id),
  referral_amount numeric not null default 5000 check (referral_amount >= 0),
  referral_min_order numeric not null default 25000 check (referral_min_order >= 0),
  referral_monthly_budget numeric not null default 500000 check (referral_monthly_budget >= 0),
  referral_credit_days integer not null default 60 check (referral_credit_days > 0),
  updated_at timestamptz not null default now()
);

comment on table public.platform_settings is
  'One row. referral_monthly_budget caps the referral credits issued per Bogotá calendar month; set it to 0 to pause the programme.';

insert into public.platform_settings (id) values (true);

alter table public.platform_settings enable row level security;

create policy "platform settings: public read"
  on public.platform_settings for select
  using (true);

-- Codes live apart from profiles: profiles are user-editable, codes are not.
create table public.referral_codes (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  created_at timestamptz not null default now()
);

alter table public.referral_codes enable row level security;

create policy "referral codes: read own"
  on public.referral_codes for select to authenticated
  using (user_id = auth.uid());

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  referred_id uuid not null unique references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  rewarded_at timestamptz,
  constraint referrals_not_self check (referrer_id <> referred_id)
);

alter table public.referrals enable row level security;

create policy "referrals: read own"
  on public.referrals for select to authenticated
  using (referrer_id = auth.uid() or referred_id = auth.uid());

create table public.customer_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric not null check (amount > 0),
  min_order numeric not null default 0 check (min_order >= 0),
  reason text not null check (reason in ('referral_welcome', 'referral_reward')),
  referral_id uuid references public.referrals (id) on delete set null,
  expires_at timestamptz not null,
  used_order_id uuid references public.orders (id) on delete set null,
  created_at timestamptz not null default now()
);

create index customer_credits_user_idx on public.customer_credits (user_id);

alter table public.customer_credits enable row level security;

create policy "credits: read own"
  on public.customer_credits for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Order columns
-- ---------------------------------------------------------------------------
alter table public.orders
  add column merchant_discount numeric not null default 0 check (merchant_discount >= 0),
  add column platform_discount numeric not null default 0 check (platform_discount >= 0),
  add column coupon_id uuid references public.coupons (id) on delete set null,
  add column loyalty_redeemed boolean not null default false,
  add column credit_id uuid references public.customer_credits (id) on delete set null;

create index orders_coupon_idx on public.orders (coupon_id) where coupon_id is not null;

create or replace function public.protect_order_discounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The service role (no user session) and admins may write discounts.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.merchant_discount <> 0
       or new.platform_discount <> 0
       or new.coupon_id is not null
       or new.loyalty_redeemed
       or new.credit_id is not null then
      raise exception 'Discounts are applied by the server only'
        using errcode = 'insufficient_privilege';
    end if;
  elsif new.merchant_discount is distinct from old.merchant_discount
     or new.platform_discount is distinct from old.platform_discount
     or new.coupon_id is distinct from old.coupon_id
     or new.loyalty_redeemed is distinct from old.loyalty_redeemed
     or new.credit_id is distinct from old.credit_id then
    raise exception 'Discounts are applied by the server only'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- Named to sort before `orders_compute_totals`: same-timing triggers fire in
-- name order, and this one must judge what the session wrote, before the
-- totals trigger clamps the discounts to the subtotal.
create trigger orders_0_protect_discounts
  before insert or update on public.orders
  for each row execute function public.protect_order_discounts();

-- ---------------------------------------------------------------------------
-- Totals and commission, on what the customer really pays
-- ---------------------------------------------------------------------------
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
  v_md numeric;
  v_pd numeric;
begin
  select s.commission_pct, s.online_payment_pct, s.founder_until
    into s_commission, s_online, s_founder_until
  from public.stores s
  where s.id = new.store_id;

  -- Mirror of `clampDiscounts` in lib/discounts.ts.
-- codegen:begin(discount_clamp)
v_md := least(greatest(round(coalesce(new.merchant_discount, 0)), 0), greatest(round(coalesce(new.subtotal, 0)), 0));
  v_pd := least(greatest(round(coalesce(new.platform_discount, 0)), 0), greatest(round(coalesce(new.subtotal, 0)), 0) - v_md);
-- codegen:end(discount_clamp)
  new.merchant_discount := v_md;
  new.platform_discount := v_pd;

  new.platform_fee := round((coalesce(new.subtotal, 0) - v_md) * (
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
  new.total := coalesce(new.subtotal, 0) - v_md - v_pd
    + coalesce(new.delivery_fee, 0) + coalesce(new.tip, 0);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Referral functions
-- ---------------------------------------------------------------------------

-- Referral credits issued this Bogotá calendar month.
create or replace function public.referral_spent_this_month()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(c.amount), 0)
  from public.customer_credits c
  where c.reason in ('referral_welcome', 'referral_reward')
    and c.created_at >= (date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota');
$$;

-- The caller's code, created on first use: 6 characters without look-alikes.
create or replace function public.ensure_referral_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  existing text;
  i integer;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;
  select code into existing from public.referral_codes where user_id = uid;
  if existing is not null then
    return existing;
  end if;
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
    end loop;
    begin
      insert into public.referral_codes (user_id, code) values (uid, candidate);
      return candidate;
    exception when unique_violation then
      -- Either the code was taken (try another) or this user got one
      -- concurrently (return it).
      select code into existing from public.referral_codes where user_id = uid;
      if existing is not null then
        return existing;
      end if;
    end;
  end loop;
end;
$$;

-- Links the caller to whoever invited them and gives the welcome credit.
-- Returns 'ok' or why not: 'invalid_code', 'self', 'already_referred',
-- 'not_new' (they already ordered), 'budget' (the month's cap is reached).
create or replace function public.claim_referral(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_referrer uuid;
  v_settings public.platform_settings%rowtype;
  v_referral uuid;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;

  select user_id into v_referrer
  from public.referral_codes
  where code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if v_referrer is null then return 'invalid_code'; end if;
  if v_referrer = uid then return 'self'; end if;
  if exists (select 1 from public.referrals where referred_id = uid) then
    return 'already_referred';
  end if;
  if exists (select 1 from public.orders where customer_id = uid) then
    return 'not_new';
  end if;

  select * into v_settings from public.platform_settings where id;
  if public.referral_spent_this_month() + v_settings.referral_amount
       > v_settings.referral_monthly_budget then
    return 'budget';
  end if;

  insert into public.referrals (referrer_id, referred_id)
  values (v_referrer, uid)
  returning id into v_referral;

  insert into public.customer_credits
    (user_id, amount, min_order, reason, referral_id, expires_at)
  values (
    uid,
    v_settings.referral_amount,
    v_settings.referral_min_order,
    'referral_welcome',
    v_referral,
    now() + make_interval(days => v_settings.referral_credit_days)
  );

  return 'ok';
end;
$$;

-- When a referred customer's first qualifying order is delivered, whoever
-- invited them gets the same credit, budget permitting. Over budget, nothing
-- is marked, so a later delivered order can still reward them.
-- When an order that used a credit is cancelled, the credit is given back.
create or replace function public.settle_order_credits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.platform_settings%rowtype;
  v_referral public.referrals%rowtype;
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled'
     and new.credit_id is not null then
    update public.customer_credits
      set used_order_id = null
      where id = new.credit_id and used_order_id = new.id;
  end if;

  if new.status = 'delivered' and old.status is distinct from 'delivered'
     and new.customer_id is not null then
    select * into v_referral
    from public.referrals
    where referred_id = new.customer_id and rewarded_at is null;
    if found then
      select * into v_settings from public.platform_settings where id;
      if coalesce(new.subtotal, 0) - coalesce(new.merchant_discount, 0) >= v_settings.referral_min_order
         and public.referral_spent_this_month() + v_settings.referral_amount
               <= v_settings.referral_monthly_budget then
        insert into public.customer_credits
          (user_id, amount, min_order, reason, referral_id, expires_at)
        values (
          v_referral.referrer_id,
          v_settings.referral_amount,
          v_settings.referral_min_order,
          'referral_reward',
          v_referral.id,
          now() + make_interval(days => v_settings.referral_credit_days)
        );
        update public.referrals set rewarded_at = now() where id = v_referral.id;
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger orders_settle_credits
  after update of status on public.orders
  for each row execute function public.settle_order_credits();

revoke all on function public.ensure_referral_code() from public;
grant execute on function public.ensure_referral_code() to authenticated;
revoke all on function public.claim_referral(text) from public;
grant execute on function public.claim_referral(text) to authenticated;
revoke all on function public.referral_spent_this_month() from public;
grant execute on function public.referral_spent_this_month() to service_role;

-- ---------------------------------------------------------------------------
-- Settlement on the discounted sale
-- ---------------------------------------------------------------------------
create or replace function public.generate_payouts(
  p_period_start date,
  p_period_end date
)
returns table (
  payouts_created integer,
  payouts_skipped integer,
  refunds_reversed integer,
  refunds_resolved integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- Mirrors `periodEndExclusive` in `lib/payouts/compute.ts`, which builds
  -- `YYYY-MM-DDT00:00:00.000Z`. `at time zone 'UTC'` is load-bearing: a bare
  -- `::timestamptz` would be read in the session's time zone and shift every
  -- period boundary by the deployment's offset.
  v_from timestamptz := (p_period_start::timestamp at time zone 'UTC');
  v_to timestamptz := ((p_period_end + 1)::timestamp at time zone 'UTC');
begin
  perform pg_advisory_xact_lock(hashtext('public.generate_payouts'));

  return query
  with eligible as (
    -- Mirror of `isEligible` + the period window in `summarizePayouts`.
    -- A store is settled on its sale (subtotal minus its own discount) and
    -- the commission: the delivery fee and the tip were never the merchant's.
    select
      o.store_id,
      sum(
-- codegen:begin(settled_gross)
(o.subtotal - o.merchant_discount)
-- codegen:end(settled_gross)
      ) as gross,
      sum(o.platform_fee) as commission,
      sum(case when
-- codegen:begin(merchant_collected)
o.payment_method = 'cash' and (o.type <> 'delivery' or o.courier_id is null)
-- codegen:end(merchant_collected)
        then
-- codegen:begin(collected_amount)
(o.subtotal - o.merchant_discount - o.platform_discount)
-- codegen:end(collected_amount)
        else 0 end) as cash_collected
    from public.orders o
    where
-- codegen:begin(eligible)
o.status = 'delivered'
    and o.payment_status <> 'refunded'
    and (o.payment_status = 'paid' or o.payment_method = 'cash')
-- codegen:end(eligible)
      and o.delivered_at >= v_from
      and o.delivered_at < v_to
    group by o.store_id
  ),
  pending as (
    -- Refunds no payout has carried yet. Mirror of `planReversals`: a refund
    -- recorded at or after this period's end is skipped entirely, because
    -- dropping a correction into a week that closed before the event would
    -- put the correction before the thing it corrects.
    select
      r.id as refund_id,
      r.store_id,
      -- Mirror of `reverseRefundedOrder`: gross reverses the sale the
      -- merchant was settled on.
      -(
-- codegen:begin(reversal_settled_gross)
(o.subtotal - o.merchant_discount)
-- codegen:end(reversal_settled_gross)
      ) as adj_gross,
-- codegen:begin(reversal_commission)
-o.platform_fee
-- codegen:end(reversal_commission)
        as adj_commission,
      -- A cash sale the merchant held was never transferred, so its reversal
      -- also takes it back out of `cash_collected`.
      case when
-- codegen:begin(reversal_merchant_collected)
o.payment_method = 'cash' and (o.type <> 'delivery' or o.courier_id is null)
-- codegen:end(reversal_merchant_collected)
        then -(
-- codegen:begin(reversal_collected_amount)
(o.subtotal - o.merchant_discount - o.platform_discount)
-- codegen:end(reversal_collected_amount)
        ) else 0 end as adj_cash,
      -- Mirror of `needsReversal`.
-- codegen:begin(reversal_needed)
exists (
      select 1
      from public.payouts settled
      where settled.store_id = r.store_id
        and o.delivered_at >= (settled.period_start::timestamp at time zone 'UTC')
        and o.delivered_at < ((settled.period_end + 1)::timestamp at time zone 'UTC')
        and settled.created_at <= r.issued_at
    )
-- codegen:end(reversal_needed)
        as needs_reversal
    from public.refunds r
    join public.orders o on o.id = r.order_id
    where r.reversed_in_payout_id is null
      and r.issued_at < v_to
  ),
  adjustments as (
    select
      p.store_id,
      sum(p.adj_gross) as gross,
      sum(p.adj_commission) as commission,
      sum(p.adj_cash) as cash_collected
    from pending p
    where p.needs_reversal
    group by p.store_id
  ),
  plan_fees as (
    -- Mirror of `planFeeForPeriod`: the monthly fee, per billable day.
    select
      s.id as store_id,
      round(pl.monthly_fee * (
-- codegen:begin(billable_days)
greatest(0, p_period_end - greatest(p_period_start, coalesce(s.founder_until + 1, p_period_start)) + 1)
-- codegen:end(billable_days)
      ) / 30) as plan_fee
    from public.stores s
    join public.plans pl on pl.id = s.plan
    where s.status = 'active'
      and pl.monthly_fee > 0
  ),
  totals as (
    select
      u.store_id,
      sum(u.gross) as gross,
      sum(u.commission) as commission,
      sum(u.cash_collected) as cash_collected,
      sum(u.plan_fee) as plan_fee
    from (
      select e.store_id, e.gross, e.commission, e.cash_collected, 0::numeric as plan_fee
      from eligible e
      union all
      select a.store_id, a.gross, a.commission, a.cash_collected, 0::numeric
      from adjustments a
      union all
      select f.store_id, 0::numeric, 0::numeric, 0::numeric, f.plan_fee
      from plan_fees f
      where f.plan_fee > 0
    ) u
    group by u.store_id
  ),
  inserted as (
    insert into public.payouts
      (store_id, period_start, period_end, gross, commission, cash_collected, plan_fee, net)
    select
      t.store_id,
      p_period_start,
      p_period_end,
      t.gross,
      t.commission,
      t.cash_collected,
      t.plan_fee,
      t.gross - t.commission - t.cash_collected - t.plan_fee
    from totals t
    on conflict on constraint payouts_store_period_key do nothing
    returning id, store_id
  ),
  stamped as (
    update public.refunds r
      set reversed_in_payout_id = i.id
    from inserted i, pending p
    where p.refund_id = r.id
      and p.store_id = i.store_id
      and r.reversed_in_payout_id is null
    returning r.id
  )
  select
    (select count(*) from inserted)::integer,
    ((select count(*) from totals) - (select count(*) from inserted))::integer,
    (select count(*) from pending p where p.needs_reversal)::integer,
    (select count(*) from stamped)::integer;
end;
$$;

revoke all on function public.generate_payouts(date, date) from public;
grant execute on function public.generate_payouts(date, date) to service_role;

reset lock_timeout;
