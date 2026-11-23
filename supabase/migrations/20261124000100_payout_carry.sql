-- Carry unpaid merchant debt forward, and pay merchants the delivery fees
-- and tips the platform collected for them.
--
-- 1. Debt carry. A payout with a negative net is a debt to the platform (the
--    commission on cash sales, the plan's monthly fee). Until now nothing ever
--    collected it: the row stayed `pending` and the next period started from
--    zero. `generate_payouts` now takes each store's open debts into its next
--    payout as `carried_in` and stamps the old rows with
--    `carried_into_payout_id`, so every debt is withheld exactly once. A
--    carried row cannot be marked paid (`payouts_carried_stays_pending`).
--    A carry only lands on a store that gets a row for another reason this
--    period (a sale, an adjustment, a plan fee): a dormant store's debt stays
--    open and visible instead of producing an empty row every week.
--
-- 2. Delivery fees and tips. When a customer pays online and no platform
--    courier is involved (pickup, table, or a delivery the merchant made with
--    their own staff), the platform is holding the merchant's delivery fee and
--    tip. They are now passed through as `delivery_and_tips`, and reversed
--    with the rest of the order when it is refunded.
--
--    net = gross - commission - cash_collected - plan_fee
--          + delivery_and_tips + carried_in
--
-- Mirrored rules are emitted by lib/payouts/sql.ts (and lib/plans-sql.ts) and
-- compared byte for byte by tests/payouts-sql-drift.test.ts, which now reads
-- this file. Do not hand-edit the generated blocks: change the rule in
-- lib/payouts/, run the test, paste the output.
--
-- Additive and reversible: three defaulted columns, two checks, one index and
-- a new body for generate_payouts with the same signature.
-- supabase/rollbacks/20261124000100_payout_carry.down.sql undoes it.
--
-- Before the first generation with this version, review the pending rows
-- with a negative net: every one of them will be carried into its store's
-- next payout. Mark as paid the debts that were already settled outside the
-- platform.

set lock_timeout = '3s';

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
alter table public.payouts
  add column delivery_and_tips numeric not null default 0,
  add column carried_in numeric not null default 0
    constraint payouts_carried_in_not_positive check (carried_in <= 0),
  add column carried_into_payout_id uuid
    references public.payouts (id) on delete set null;

alter table public.payouts
  add constraint payouts_not_carried_into_itself
    check (carried_into_payout_id is null or carried_into_payout_id <> id),
  -- A carried debt was settled by the row it moved into; marking it paid as
  -- well would withhold it twice.
  add constraint payouts_carried_stays_pending
    check (carried_into_payout_id is null or status = 'pending');

-- The rows a generation run may carry, per store.
create index payouts_open_debt_idx
  on public.payouts (store_id)
  where status = 'pending' and net < 0 and carried_into_payout_id is null;

comment on column public.payouts.delivery_and_tips is
  'Delivery fees and tips the platform collected online for orders the merchant handed over themselves (no platform courier). Added to net.';
comment on column public.payouts.carried_in is
  'Unpaid debt from earlier payouts of this store, withheld here. Never positive.';
comment on column public.payouts.carried_into_payout_id is
  'Set on a negative payout once a later payout carried its debt. The row is then closed: it cannot be marked paid.';

-- ---------------------------------------------------------------------------
-- 2. generate_payouts, v3
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

  -- Lock the debts this run may carry before the main statement takes its
  -- snapshot. A concurrent `markPayoutPaid` on one of them waits here, and
  -- once this transaction commits it finds the row carried and refuses.
  perform 1
  from public.payouts prev
  where
-- codegen:begin(carryable_lock)
prev.status = 'pending' and prev.net < 0 and prev.carried_into_payout_id is null and prev.period_end < p_period_start
-- codegen:end(carryable_lock)
  for update;

  return query
  with eligible as (
    -- Mirror of `isEligible` + the period window in `summarizePayouts`.
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
        else 0 end) as cash_collected,
      -- Mirror of `isPassedThroughToMerchant`: delivery fee and tip the
      -- platform collected for an order the merchant handed over.
      sum(case when
-- codegen:begin(merchant_passthrough)
o.payment_method <> 'cash' and (o.type <> 'delivery' or o.courier_id is null)
-- codegen:end(merchant_passthrough)
        then
-- codegen:begin(passthrough_amount)
(o.delivery_fee + o.tip)
-- codegen:end(passthrough_amount)
        else 0 end) as delivery_and_tips
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
    -- recorded at or after this period's end is skipped entirely.
    select
      r.id as refund_id,
      r.store_id,
      -(
-- codegen:begin(reversal_settled_gross)
(o.subtotal - o.merchant_discount)
-- codegen:end(reversal_settled_gross)
      ) as adj_gross,
-- codegen:begin(reversal_commission)
-o.platform_fee
-- codegen:end(reversal_commission)
        as adj_commission,
      case when
-- codegen:begin(reversal_merchant_collected)
o.payment_method = 'cash' and (o.type <> 'delivery' or o.courier_id is null)
-- codegen:end(reversal_merchant_collected)
        then -(
-- codegen:begin(reversal_collected_amount)
(o.subtotal - o.merchant_discount - o.platform_discount)
-- codegen:end(reversal_collected_amount)
        ) else 0 end as adj_cash,
      -- The customer got the delivery fee and tip back too, so what was
      -- passed through to the merchant for that order is taken back.
      case when
-- codegen:begin(reversal_merchant_passthrough)
o.payment_method <> 'cash' and (o.type <> 'delivery' or o.courier_id is null)
-- codegen:end(reversal_merchant_passthrough)
        then -(
-- codegen:begin(reversal_passthrough_amount)
(o.delivery_fee + o.tip)
-- codegen:end(reversal_passthrough_amount)
        ) else 0 end as adj_passthrough,
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
      sum(p.adj_cash) as cash_collected,
      sum(p.adj_passthrough) as delivery_and_tips
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
      sum(u.plan_fee) as plan_fee,
      sum(u.delivery_and_tips) as delivery_and_tips
    from (
      select e.store_id, e.gross, e.commission, e.cash_collected,
        0::numeric as plan_fee, e.delivery_and_tips
      from eligible e
      union all
      select a.store_id, a.gross, a.commission, a.cash_collected,
        0::numeric, a.delivery_and_tips
      from adjustments a
      union all
      select f.store_id, 0::numeric, 0::numeric, 0::numeric,
        f.plan_fee, 0::numeric
      from plan_fees f
      where f.plan_fee > 0
    ) u
    group by u.store_id
  ),
  carry as (
    -- Mirror of `isCarryable`: open debts from periods that ended before
    -- this one starts.
    select prev.id, prev.store_id, prev.net
    from public.payouts prev
    where
-- codegen:begin(carryable)
prev.status = 'pending' and prev.net < 0 and prev.carried_into_payout_id is null and prev.period_end < p_period_start
-- codegen:end(carryable)
  ),
  carry_totals as (
    select c.store_id, sum(c.net) as carried_in
    from carry c
    group by c.store_id
  ),
  inserted as (
    insert into public.payouts (
      store_id, period_start, period_end, gross, commission, cash_collected,
      plan_fee, delivery_and_tips, carried_in, net
    )
    select
      t.store_id,
      p_period_start,
      p_period_end,
      t.gross,
      t.commission,
      t.cash_collected,
      t.plan_fee,
      t.delivery_and_tips,
      coalesce(ct.carried_in, 0),
-- codegen:begin(payout_net)
t.gross - t.commission - t.cash_collected - t.plan_fee + t.delivery_and_tips + coalesce(ct.carried_in, 0)
-- codegen:end(payout_net)
    -- Only stores with a row of their own this period: a carry alone never
    -- creates one (mirror of `summarizePayouts`).
    from totals t
    left join carry_totals ct on ct.store_id = t.store_id
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
  ),
  carried as (
    -- Closes each carried debt. A store whose period already existed got no
    -- inserted row, so nothing of it is stamped and nothing is counted twice.
    update public.payouts prev
      set carried_into_payout_id = i.id
    from inserted i, carry c
    where prev.id = c.id
      and c.store_id = i.store_id
      and prev.carried_into_payout_id is null
      and prev.status = 'pending'
    returning prev.id
  )
  select
    (select count(*) from inserted)::integer,
    ((select count(*) from totals) - (select count(*) from inserted))::integer,
    (select count(*) from pending p where p.needs_reversal)::integer,
    -- `carried` is referenced so the stamp is visibly part of the result;
    -- PostgreSQL runs data-modifying CTEs to completion either way.
    ((select count(*) from stamped) + 0 * (select count(*) from carried))::integer;
end;
$$;

revoke all on function public.generate_payouts(date, date) from public;
grant execute on function public.generate_payouts(date, date) to service_role;

reset lock_timeout;
