-- Settlement: what the platform really owes each store.
--
-- ---------------------------------------------------------------------------
-- The defect this closes
-- ---------------------------------------------------------------------------
-- A payout was `net = gross - commission`, with `gross` summing every eligible
-- subtotal, cash ones included. But cash taken at the counter, at the table
-- or on a delivery the merchant made themselves is already in the merchant's
-- till. Transferring `net` paid those sales a second time, out of the
-- platform's pocket. Only a cash delivery taken by a platform courier puts
-- the money on the platform's side, and that one is still owed.
--
-- ---------------------------------------------------------------------------
-- The new arithmetic
-- ---------------------------------------------------------------------------
--   net = gross - commission - cash_collected - plan_fee
--
--   * `cash_collected`: subtotals the merchant collected in cash
--     (`isCollectedByMerchant` in lib/payouts/compute.ts);
--   * `plan_fee`: the plan's monthly fee from `public.plans`, prorated per day
--     of the period (monthly / 30), excluding days still inside the founder
--     period (`billableDays` in lib/plans.ts). A store with a fee and no
--     sales still gets a row: it owes its plan.
--
-- A negative net is a debt to the platform, exactly as before
-- (`isDebtToPlatform`): a store that sells mostly in cash owes the
-- commission on those sales and its plan fee.
--
-- The plan read is the store's plan when the period is generated. Periods
-- are assumed not to overlap, as they already were for orders.
--
-- Mirrored rules are emitted by lib/payouts/sql.ts and lib/plans-sql.ts and
-- compared byte for byte by tests/payouts-sql-drift.test.ts. Do not hand-edit
-- the blocks between `codegen:` markers.

set lock_timeout = '3s';

alter table public.payouts
  add column cash_collected numeric not null default 0,
  add column plan_fee numeric not null default 0;

comment on column public.payouts.cash_collected is
  'Subtotals the merchant collected in cash in this period; never transferred.';
comment on column public.payouts.plan_fee is
  'Plan monthly fee prorated to the period, after the founder period.';

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
    -- A store is settled on subtotal and commission only: the delivery fee
    -- and the tip were never the merchant's.
    select
      o.store_id,
      sum(o.subtotal) as gross,
      sum(o.platform_fee) as commission,
      sum(case when
-- codegen:begin(merchant_collected)
o.payment_method = 'cash' and (o.type <> 'delivery' or o.courier_id is null)
-- codegen:end(merchant_collected)
        then o.subtotal else 0 end) as cash_collected
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
    -- put the correction before the thing it corrects. It waits for a period
    -- that could contain it.
    --
    -- The settlement figures come from the ORDER, not the refund: the refund
    -- records what the customer got back (the order total), while a payout is
    -- settled on subtotal and platform_fee only.
    select
      r.id as refund_id,
      r.store_id,
      -- Mirror of `reverseRefundedOrder`: gross reverses the subtotal the
      -- merchant was settled on.
      -o.subtotal as adj_gross,
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
        then -o.subtotal else 0 end as adj_cash,
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
    -- Adjustments fold in as ordinary — negative — contributions, so a store
    -- whose only activity this period is a reversal still gets a row, and a
    -- period whose reversals exceed its sales comes out negative rather than
    -- clamped: that debt is real and `isDebtToPlatform` names it in the UI.
    -- A plan fee alone produces a row for the same reason.
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
    -- The period was already generated. `do nothing` rather than an update:
    -- a settled payout row is immutable, because it describes a transfer
    -- that really happened. The store's refunds stay pending on purpose —
    -- their reversal has been carried nowhere, and stamping them here would
    -- lose the money silently.
    on conflict on constraint payouts_store_period_key do nothing
    returning id, store_id
  ),
  stamped as (
    -- Every pending refund considered this run is stamped with the row that
    -- carried it, including the ones that produced no adjustment: they never
    -- will, and leaving them pending would make every future run reconsider
    -- them forever. Only stores that actually got a row stamp anything, so a
    -- skipped store keeps its refunds.
    --
    -- `reversed_in_payout_id is null` is re-checked here rather than trusted
    -- from the CTE: under READ COMMITTED a concurrent writer's committed
    -- update is re-evaluated against this predicate, so a refund another
    -- transaction stamped first is skipped instead of overwritten. The
    -- advisory lock above should make that unreachable; this is the belt to
    -- its braces, and it costs nothing.
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

comment on function public.generate_payouts is
  'Generates one period of payouts atomically: eligibility, cash already held '
  'by the merchant, plan fees, reversals, payout rows and refund stamps in a '
  'single transaction. Called only by app/admin/actions.ts.';

revoke all on function public.generate_payouts(date, date) from public;
grant execute on function public.generate_payouts(date, date) to service_role;

reset lock_timeout;
