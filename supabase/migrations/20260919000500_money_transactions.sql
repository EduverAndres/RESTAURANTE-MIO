-- Every money-mutating operation becomes ONE transaction.
--
-- ---------------------------------------------------------------------------
-- The defect class this closes
-- ---------------------------------------------------------------------------
-- Recording a refund and generating payouts were both composed of several
-- sequential writes issued from JavaScript over PostgREST. PostgREST gives
-- each call its own transaction, so there is no way to make two of them
-- atomic from the application side — and both flows moved money:
--
--   * refund: insert the `refunds` row, then move `orders.payment_status` to
--     `refunded`. If the second write failed the first was deleted again; if
--     that compensating delete ALSO failed, a refund row stayed committed on
--     an order that still reads as paid. Payout generation then settles that
--     sale in full and the refund never produces a clawback, because it
--     predates any payout. Nothing surfaced the disagreement.
--
--   * payouts: read the eligible orders, read the pending refunds, read the
--     settled payouts, insert a payout row per store, stamp the refunds that
--     row carried. Two holes. A stamp that failed left the deduction applied
--     and the refund still pending, so `needsReversal` re-matched the same
--     original payout on every later run and debited the merchant for the
--     same refund every period, forever. And the orders snapshot was read
--     before the refunds were: a refund recorded in that window left the
--     snapshot reading `paid`, so the full sale was settled while the refund
--     was stamped resolved with no adjustment — the clawback closed at zero.
--
-- No amount of application-side care fixes either one; they are two
-- statements with a gap in between, exactly like the read-then-write the
-- rate limiter avoids in `20260919000300_rate_limits.sql`. The fix is the
-- same shape: move the whole operation to where a transaction exists.
--
-- ---------------------------------------------------------------------------
-- Business rules now live in two places
-- ---------------------------------------------------------------------------
-- `generate_payouts` has to DECIDE (which orders are eligible, which refunds
-- still owe a clawback) inside the transaction, so those rules are mirrored
-- from `lib/payouts/compute.ts` and `lib/payouts/reversal.ts` into the SQL
-- below. That is duplication and it is stated loudly rather than hidden:
-- every mirrored fragment is emitted by `lib/payouts/sql.ts` and pasted
-- between `codegen:` markers, and `tests/payouts-sql-drift.test.ts` fails the
-- build when this file and that module disagree — the same tripwire
-- `scripts/audit-unapplied-events.sql` uses. DO NOT HAND-EDIT the generated
-- blocks: change the rule in `lib/`, run the test, paste its output in.
--
-- `record_refund` mirrors NOTHING, on purpose: see the note on its optimistic
-- precondition below.
--
-- ---------------------------------------------------------------------------
-- Migration mechanics
-- ---------------------------------------------------------------------------
-- No BEGIN/COMMIT: `supabase db push` already wraps each file in one
-- transaction together with its `schema_migrations` bookkeeping, and nesting
-- one inside would commit early. Every statement here is catalogue-only
-- (`create function`, `grant`), so nothing scans or rewrites a table and the
-- locks are held for microseconds. The `lock_timeout` is the same guard
-- `20260919000200_payment_events_applied_at.sql` sets: if another session is
-- holding what we need, fail fast and let the operator re-run rather than
-- stacking live traffic behind us. Plain SET rather than SET LOCAL, because
-- SET LOCAL outside a transaction block is a no-op with a warning.
set lock_timeout = '3s';

-- ===========================================================================
-- Refunds
-- ===========================================================================
-- Writes the bookkeeping record that money went back AND moves the order in
-- one transaction, so the orphaned-refund state is not reachable: either both
-- land or neither does, and no compensating delete has to be trusted.
--
-- Nothing here calls a payment provider. See `lib/refunds/gateway.ts` for why
-- that seam is deliberately empty.
--
-- ---------------------------------------------------------------------------
-- Why the payment-status rules are NOT mirrored here
-- ---------------------------------------------------------------------------
-- `lib/refunds/plan.ts` decides whether an order may be refunded, and part of
-- that decision is `canApplyPaymentStatus` in `lib/payments/transitions.ts`.
-- Re-encoding its FORBIDDEN table in SQL would be a second copy of a rule
-- that changes, for no gain — because `p_expected_payment_status` already
-- carries the answer: it is the exact status the TypeScript guard evaluated.
-- The function refuses unless the row still holds that status, so a decision
-- made against a stale read cannot be applied. Any change in the gap aborts
-- the refund and the caller re-reads and re-decides. That is strictly
-- stronger than a mirrored rule set, which would only re-check the same
-- literals against the same (possibly stale) intent.
--
-- `select ... for update` serialises two people refunding the same order:
-- the second waits, then sees `refunded` where it expected `paid` and is
-- turned away. The unique index `refunds_order_id_key` remains the last line
-- of defence, surfaced as `already_refunded`.
--
-- `store_id` and `amount`: `store_id` is read from the order inside the
-- transaction rather than taken from the caller, because it is a
-- denormalisation and not a decision — there is no reason to trust a snapshot
-- for it. `amount` IS passed in, because `planRefund` owns it: it is a
-- snapshot of what was handed back, in pesos, the same units as
-- `orders.total` (never cents).
create or replace function public.record_refund(
  p_order_id uuid,
  p_expected_payment_status public.payment_status,
  p_amount numeric,
  p_reason text,
  p_method text,
  p_note text,
  p_issued_by uuid
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_store_id uuid;
  v_current public.payment_status;
begin
  select o.store_id, o.payment_status
    into v_store_id, v_current
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    return 'order_not_found';
  end if;

  if v_current is distinct from p_expected_payment_status then
    return 'status_changed';
  end if;

  insert into public.refunds
    (order_id, store_id, amount, reason, method, note, issued_by)
  values
    (p_order_id, v_store_id, p_amount, p_reason, p_method, p_note, p_issued_by);

  update public.orders
    set payment_status = 'refunded'
  where id = p_order_id;

  return 'ok';
exception
  -- `refunds_order_id_key`. Full refunds only, and two clicks racing each
  -- other past the application check land here.
  when unique_violation then
    return 'already_refunded';
end;
$$;

comment on function public.record_refund is
  'Records a refund and moves the order to refunded, atomically. Returns ok, '
  'order_not_found, status_changed or already_refunded. Called only by '
  'lib/refunds/record.ts.';

-- Least privilege, like `consume_rate_limit`: only trusted server code
-- holding the service-role key calls this. A browser session that could
-- invoke it directly could write refunds on any order, which is precisely
-- why `refunds` has no owner INSERT policy.
revoke all on function public.record_refund(
  uuid, public.payment_status, numeric, text, text, text, uuid
) from public;
grant execute on function public.record_refund(
  uuid, public.payment_status, numeric, text, text, text, uuid
) to service_role;

-- ===========================================================================
-- Payout generation
-- ===========================================================================
-- Reads eligibility, plans the reversals, inserts the payout rows and stamps
-- the refunds those rows carried — all in one statement, therefore one
-- snapshot and one commit. Both holes described at the top of this file close
-- together, because they were the same hole: a gap between reading and
-- writing money.
--
-- One transaction per RUN, not per store. Per-store would still be correct
-- for the stamping (each store's refunds ride that store's row), but the
-- caller reports one `created`/`skipped` pair for the run, and a partially
-- generated period is exactly the half-applied state this migration exists to
-- remove: an operator who sees "3 of 9 generated" cannot tell whether
-- re-running is safe without reading the table. Per run, re-running is always
-- safe: either the period exists or it does not.
--
-- The advisory lock makes generation single-flight. Without it, two runs for
-- DIFFERENT periods could both see the same pending refund and both fold its
-- negative adjustment in, while only one stamp lands. Generation is an admin
-- batch action, not a hot path, so serialising it costs nothing and removes
-- the whole class. `pg_advisory_xact_lock` releases on commit or rollback,
-- with no unlock to forget.
--
-- There is no `limit` anywhere below, unlike the JavaScript version's 20000
-- orders and 5000 refunds. Those caps silently dropped money past the cap;
-- set-based SQL has no reason to truncate.
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
      sum(o.platform_fee) as commission
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
      sum(p.adj_commission) as commission
    from pending p
    where p.needs_reversal
    group by p.store_id
  ),
  totals as (
    -- Adjustments fold in as ordinary — negative — contributions, so a store
    -- whose only activity this period is a reversal still gets a row, and a
    -- period whose reversals exceed its sales comes out negative rather than
    -- clamped: that debt is real and `isDebtToPlatform` names it in the UI.
    select
      u.store_id,
      sum(u.gross) as gross,
      sum(u.commission) as commission
    from (
      select e.store_id, e.gross, e.commission from eligible e
      union all
      select a.store_id, a.gross, a.commission from adjustments a
    ) u
    group by u.store_id
  ),
  inserted as (
    insert into public.payouts
      (store_id, period_start, period_end, gross, commission, net)
    select
      t.store_id,
      p_period_start,
      p_period_end,
      t.gross,
      t.commission,
      t.gross - t.commission
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
  'Generates one period of payouts atomically: eligibility, reversals, payout '
  'rows and refund stamps in a single transaction. Called only by '
  'app/admin/actions.ts.';

revoke all on function public.generate_payouts(date, date) from public;
grant execute on function public.generate_payouts(date, date) to service_role;

reset lock_timeout;
