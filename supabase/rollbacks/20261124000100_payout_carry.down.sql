-- Reverts supabase/migrations/20261124000100_payout_carry.sql.
--
-- Not picked up by `supabase db push` (this folder is not a migrations
-- folder). Run by hand, then forget the migration so it can be re-applied:
--   psql "$SUPABASE_DB_URL" -f supabase/rollbacks/20261124000100_payout_carry.down.sql
--   psql "$SUPABASE_DB_URL" -c "delete from supabase_migrations.schema_migrations where version = '20261124000100'"
--
-- Restores generate_payouts v2 (copied verbatim from
-- 20261105000300_discounts_loyalty_referrals.sql) and drops the new columns.
-- Payouts generated with v3 keep their `net`, which already includes the
-- carried debt and the delivery fees and tips; dropping the columns loses the
-- breakdown and the carried stamps. Export them first if they matter:
--   select id, delivery_and_tips, carried_in, carried_into_payout_id
--   from public.payouts
--   where delivery_and_tips <> 0 or carried_in <> 0 or carried_into_payout_id is not null;

set lock_timeout = '3s';

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

drop index if exists public.payouts_open_debt_idx;

alter table public.payouts
  drop constraint if exists payouts_carried_stays_pending,
  drop constraint if exists payouts_not_carried_into_itself,
  drop column if exists carried_into_payout_id,
  drop column if exists carried_in,
  drop column if exists delivery_and_tips;

reset lock_timeout;
