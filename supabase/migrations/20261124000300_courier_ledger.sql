-- The courier ledger: what the platform owes each courier, what each courier
-- owes the platform, a cap on cash debt, and periodic courier payouts.
--
-- Two holes this closes:
--
--   * On a cash delivery the courier collects the whole total, but merchant
--     payouts settle the merchant as if the platform had received it
--     (lib/payouts/compute.ts, isCollectedByMerchant). Nothing ever asked the
--     courier for that cash. Now every such delivery puts it on the courier's
--     books as `cash_collected`.
--   * On an online delivery the platform keeps the courier's delivery fee
--     and tip, and nothing ever paid them. Now they are `earnings`.
--
-- A trigger on `orders` writes one ledger entry per delivered order taken by
-- a platform courier (mirrored in lib/couriers/ledger.ts). Admins record cash
-- deposits and adjustments as signed entries. `generate_courier_payouts`
-- settles a period into `courier_payouts` exactly like merchant payouts
-- (net = earnings - cash_collected + adjustments + carried_in), carrying a
-- courier's debt into their next period with the same rule.
--
-- The cap: a courier whose cash debt (open entries and payouts, plus cash
-- orders they are carrying) would go over `platform_settings
-- .courier_cash_debt_cap` with the next order cannot claim another cash
-- order until they deposit. Enforced in a BEFORE UPDATE trigger on
-- `orders.courier_id`, serialised per courier.
--
-- The ledger starts empty: deliveries made before this migration are
-- reconciled by hand. A refund never touches it (the courier delivered, and
-- holds the cash): REFUND_KEEPS_COURIER_EARNINGS in lib/couriers/ledger.ts.
--
-- Privacy (Ley 1581): amounts per courier. The courier reads their own rows,
-- admins read all, nobody writes through the API.
--
-- Additive and reversible: one column, two tables, five functions, two
-- triggers. supabase/rollbacks/20261124000300_courier_ledger.down.sql undoes
-- it.

set lock_timeout = '3s';

-- ---------------------------------------------------------------------------
-- 1. The cap
-- ---------------------------------------------------------------------------
alter table public.platform_settings
  add column courier_cash_debt_cap numeric not null default 150000
    constraint platform_settings_courier_cash_cap_check
      check (courier_cash_debt_cap >= 0);

comment on column public.platform_settings.courier_cash_debt_cap is
  'Pesos of cash a courier may owe (including cash orders in progress) before they can no longer claim cash orders.';

-- ---------------------------------------------------------------------------
-- 2. Courier payouts
-- ---------------------------------------------------------------------------
create table public.courier_payouts (
  id uuid primary key default gen_random_uuid(),
  courier_id uuid not null references public.profiles (id) on delete restrict,
  period_start date not null,
  period_end date not null,
  deliveries integer not null default 0 check (deliveries >= 0),
  earnings numeric not null default 0,
  cash_collected numeric not null default 0,
  adjustments numeric not null default 0,
  carried_in numeric not null default 0
    constraint courier_payouts_carried_in_not_positive check (carried_in <= 0),
  net numeric not null default 0,
  status public.payout_status not null default 'pending',
  paid_at timestamptz,
  carried_into_payout_id uuid
    references public.courier_payouts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint courier_payouts_period_key
    unique (courier_id, period_start, period_end),
  constraint courier_payouts_period_order check (period_start <= period_end),
  constraint courier_payouts_not_carried_into_itself
    check (carried_into_payout_id is null or carried_into_payout_id <> id),
  constraint courier_payouts_carried_stays_pending
    check (carried_into_payout_id is null or status = 'pending')
);

create index courier_payouts_open_debt_idx
  on public.courier_payouts (courier_id)
  where status = 'pending' and net < 0 and carried_into_payout_id is null;

create trigger courier_payouts_set_updated_at
  before update on public.courier_payouts
  for each row execute function public.set_updated_at();

alter table public.courier_payouts enable row level security;

create policy "courier_payouts: courier reads own"
  on public.courier_payouts for select to authenticated
  using (courier_id = auth.uid());

create policy "courier_payouts: admin full access"
  on public.courier_payouts for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.courier_payouts from anon, authenticated;
grant select on public.courier_payouts to authenticated;

-- ---------------------------------------------------------------------------
-- 3. The ledger
-- ---------------------------------------------------------------------------
create table public.courier_ledger (
  id uuid primary key default gen_random_uuid(),
  courier_id uuid not null references public.profiles (id) on delete restrict,
  kind text not null
    constraint courier_ledger_kind_check
      check (kind in ('delivery', 'deposit', 'adjustment')),
  -- Restrict: a delivered order with money on someone's books is never
  -- deleted out from under its entry.
  order_id uuid references public.orders (id) on delete restrict,
  store_id uuid references public.stores (id) on delete set null,
  occurred_at timestamptz not null default now(),
  payment_method public.payment_method,
  earnings numeric not null default 0 check (earnings >= 0),
  cash_collected numeric not null default 0 check (cash_collected >= 0),
  -- Signed: a deposit pays the courier's debt down (positive); an admin
  -- adjustment may go either way.
  amount numeric not null default 0,
  note text check (note is null or char_length(note) <= 200),
  created_by uuid references public.profiles (id) on delete set null,
  settled_in_payout_id uuid
    references public.courier_payouts (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint courier_ledger_delivery_shape
    check (kind <> 'delivery' or (order_id is not null and amount = 0)),
  constraint courier_ledger_money_shape
    check (kind = 'delivery' or (earnings = 0 and cash_collected = 0)),
  constraint courier_ledger_deposit_positive
    check (kind <> 'deposit' or amount > 0)
);

create unique index courier_ledger_delivery_order_key
  on public.courier_ledger (order_id)
  where kind = 'delivery';

create index courier_ledger_open_idx
  on public.courier_ledger (courier_id, occurred_at)
  where settled_in_payout_id is null;

create index courier_ledger_courier_idx
  on public.courier_ledger (courier_id, occurred_at desc);

alter table public.courier_ledger enable row level security;

create policy "courier_ledger: courier reads own"
  on public.courier_ledger for select to authenticated
  using (courier_id = auth.uid());

create policy "courier_ledger: admin full access"
  on public.courier_ledger for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.courier_ledger from anon, authenticated;
grant select on public.courier_ledger to authenticated;

-- ---------------------------------------------------------------------------
-- 4. One entry per delivery
-- ---------------------------------------------------------------------------
create or replace function public.record_courier_delivery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if
-- codegen:begin(courier_entry_eligible)
new.status = 'delivered' and new.type = 'delivery' and new.courier_id is not null and (new.payment_method = 'cash' or new.payment_status in ('paid', 'refunded'))
-- codegen:end(courier_entry_eligible)
  then
    insert into public.courier_ledger
      (courier_id, kind, order_id, store_id, occurred_at, payment_method,
       earnings, cash_collected)
    values (
      new.courier_id,
      'delivery',
      new.id,
      new.store_id,
      coalesce(new.delivered_at, now()),
      new.payment_method,
-- codegen:begin(courier_earnings)
(new.delivery_fee + new.tip)
-- codegen:end(courier_earnings)
      ,
-- codegen:begin(courier_cash)
(case when new.payment_method = 'cash' then new.total else 0 end)
-- codegen:end(courier_cash)
    )
    -- An online payment confirmed after the delivery fires this again;
    -- the first entry stands.
    on conflict (order_id) where kind = 'delivery' do nothing;
  end if;
  return new;
end;
$$;

create trigger orders_record_courier_delivery
  after update of status, payment_status on public.orders
  for each row execute function public.record_courier_delivery();

revoke all on function public.record_courier_delivery() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Balance and cash exposure
-- ---------------------------------------------------------------------------
-- Signed position: positive when the platform owes the courier.
create or replace function public.courier_cash_balance(p_courier uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((
      select sum(l.earnings - l.cash_collected + l.amount)
      from public.courier_ledger l
      where l.courier_id = p_courier
        and l.settled_in_payout_id is null
    ), 0)
    + coalesce((
      select sum(p.net)
      from public.courier_payouts p
      where p.courier_id = p_courier
        and p.status = 'pending'
        and p.carried_into_payout_id is null
    ), 0);
$$;

-- What the courier will owe on cash orders they are carrying right now.
create or replace function public.courier_cash_in_progress(p_courier uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
-- codegen:begin(courier_cash_owed_in_progress)
greatest(0, (case when o.payment_method = 'cash' then o.total else 0 end) - (o.delivery_fee + o.tip))
-- codegen:end(courier_cash_owed_in_progress)
  ), 0)
  from public.orders o
  where o.courier_id = p_courier
    and o.type = 'delivery'
    and o.status in ('ready', 'picked_up');
$$;

revoke all on function public.courier_cash_balance(uuid) from public, anon, authenticated;
grant execute on function public.courier_cash_balance(uuid) to service_role;
revoke all on function public.courier_cash_in_progress(uuid) from public, anon, authenticated;
grant execute on function public.courier_cash_in_progress(uuid) to service_role;

-- The signed-in courier's own standing, for their earnings page.
create or replace function public.my_courier_cash_status()
returns table (
  balance numeric,
  in_progress numeric,
  exposure numeric,
  cap numeric,
  blocked boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_balance numeric;
  v_progress numeric;
  v_cap numeric;
begin
  if auth.uid() is null then
    return;
  end if;
  v_balance := public.courier_cash_balance(auth.uid());
  v_progress := public.courier_cash_in_progress(auth.uid());
  select s.courier_cash_debt_cap into v_cap
  from public.platform_settings s
  where s.id;
  return query
    select v_balance, v_progress, v_progress - v_balance, v_cap,
      (v_progress - v_balance) >= v_cap;
end;
$$;

revoke all on function public.my_courier_cash_status() from public, anon;
grant execute on function public.my_courier_cash_status() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. The cap on claiming cash orders
-- ---------------------------------------------------------------------------
create or replace function public.guard_courier_cash_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap numeric;
  v_exposure numeric;
  v_owed numeric;
begin
  -- Only a courier claiming through the API is capped: the service role and
  -- admins may assign anyone.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if old.courier_id is not null or new.courier_id is null then
    return new;
  end if;
  if new.payment_method <> 'cash' then
    return new;
  end if;

  -- Serialises this courier's simultaneous claims, so two taps cannot both
  -- pass the check on the same headroom.
  perform 1
  from public.courier_profiles
  where user_id = new.courier_id
  for update;

  v_owed :=
-- codegen:begin(courier_cash_owed_new)
greatest(0, (case when new.payment_method = 'cash' then new.total else 0 end) - (new.delivery_fee + new.tip))
-- codegen:end(courier_cash_owed_new)
  ;
  select s.courier_cash_debt_cap into v_cap
  from public.platform_settings s
  where s.id;
  v_exposure := public.courier_cash_in_progress(new.courier_id)
    - public.courier_cash_balance(new.courier_id);

  if v_exposure + v_owed > v_cap then
    raise exception 'courier_cash_cap'
      using errcode = 'P0001',
        hint = 'Consigna el efectivo que tienes para seguir tomando pedidos en efectivo.';
  end if;
  return new;
end;
$$;

create trigger orders_guard_courier_cash_cap
  before update of courier_id on public.orders
  for each row execute function public.guard_courier_cash_cap();

revoke all on function public.guard_courier_cash_cap() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Courier payouts, per period
-- ---------------------------------------------------------------------------
create or replace function public.generate_courier_payouts(
  p_period_start date,
  p_period_end date
)
returns table (
  payouts_created integer,
  payouts_skipped integer,
  entries_settled integer,
  debts_carried integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- Same UTC day boundary as generate_payouts.
  v_to timestamptz := ((p_period_end + 1)::timestamp at time zone 'UTC');
begin
  perform pg_advisory_xact_lock(hashtext('public.generate_courier_payouts'));

  perform 1
  from public.courier_payouts prev
  where
-- codegen:begin(courier_carryable_lock)
prev.status = 'pending' and prev.net < 0 and prev.carried_into_payout_id is null and prev.period_end < p_period_start
-- codegen:end(courier_carryable_lock)
  for update;

  return query
  with entries as (
    -- Everything not settled yet up to the end of the period, stragglers
    -- from earlier periods included.
    select l.id, l.courier_id, l.kind, l.earnings, l.cash_collected, l.amount
    from public.courier_ledger l
    where l.settled_in_payout_id is null
      and l.occurred_at < v_to
  ),
  totals as (
    select
      e.courier_id,
      (count(*) filter (where e.kind = 'delivery'))::integer as deliveries,
      sum(e.earnings) as earnings,
      sum(e.cash_collected) as cash_collected,
      sum(e.amount) as adjustments
    from entries e
    group by e.courier_id
  ),
  carry as (
    select prev.id, prev.courier_id, prev.net
    from public.courier_payouts prev
    where
-- codegen:begin(courier_carryable)
prev.status = 'pending' and prev.net < 0 and prev.carried_into_payout_id is null and prev.period_end < p_period_start
-- codegen:end(courier_carryable)
  ),
  carry_totals as (
    select c.courier_id, sum(c.net) as carried_in
    from carry c
    group by c.courier_id
  ),
  inserted as (
    insert into public.courier_payouts (
      courier_id, period_start, period_end, deliveries, earnings,
      cash_collected, adjustments, carried_in, net
    )
    select
      t.courier_id,
      p_period_start,
      p_period_end,
      t.deliveries,
      t.earnings,
      t.cash_collected,
      t.adjustments,
      coalesce(ct.carried_in, 0),
-- codegen:begin(courier_payout_net)
t.earnings - t.cash_collected + t.adjustments + coalesce(ct.carried_in, 0)
-- codegen:end(courier_payout_net)
    from totals t
    left join carry_totals ct on ct.courier_id = t.courier_id
    on conflict on constraint courier_payouts_period_key do nothing
    returning id, courier_id
  ),
  settled as (
    update public.courier_ledger l
      set settled_in_payout_id = i.id
    from inserted i, entries e
    where l.id = e.id
      and e.courier_id = i.courier_id
      and l.settled_in_payout_id is null
    returning l.id
  ),
  carried as (
    update public.courier_payouts prev
      set carried_into_payout_id = i.id
    from inserted i, carry c
    where prev.id = c.id
      and c.courier_id = i.courier_id
      and prev.carried_into_payout_id is null
      and prev.status = 'pending'
    returning prev.id
  )
  select
    (select count(*) from inserted)::integer,
    ((select count(*) from totals) - (select count(*) from inserted))::integer,
    (select count(*) from settled)::integer,
    (select count(*) from carried)::integer;
end;
$$;

revoke all on function public.generate_courier_payouts(date, date) from public, anon, authenticated;
grant execute on function public.generate_courier_payouts(date, date) to service_role;

reset lock_timeout;
