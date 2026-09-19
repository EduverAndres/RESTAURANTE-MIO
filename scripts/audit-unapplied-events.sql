-- Read-only audit of gateway events that may never have reached their order.
--
-- Run this BEFORE `20260919000200_payment_events_applied_at.sql`.
--
-- That migration adds `payment_events.applied_at` and stamps every
-- pre-existing row as applied. It has to: those rows went through a handler
-- that answered 200 even when the orders-UPDATE failed, so a genuine success
-- and a silent loss are indistinguishable in the data, and leaving them NULL
-- would make a future gateway replay re-run months of history. Treating
-- history as applied is the right default — but it also erases the only
-- evidence that anything was ever lost. This script reads that evidence out
-- first, so the assumption is a decision someone made rather than a signal
-- that vanished.
--
-- After the migration this query still works and stays useful: it keeps
-- answering "which events do not agree with their order?", which is the
-- operational question the partial index exists for. The same question is
-- answered continuously by `/admin/payments`, which lists events whose
-- `applied_at` is still NULL; this script is the wider net, because it also
-- catches an event that was stamped applied and still disagrees.
--
-- Nothing here writes. Run it with a service-role connection:
--   psql "$SUPABASE_DB_URL" -f scripts/audit-unapplied-events.sql
--
-- ---------------------------------------------------------------------------
-- Generated blocks
-- ---------------------------------------------------------------------------
-- The `case` and the `where` below are emitted by
-- `lib/payments/unapplied-events.ts` and pasted between the `codegen:`
-- markers. Do not hand-edit them: change the rules in that module and copy
-- the new output in. `tests/unapplied-events.test.ts` compares this file
-- against the module and fails when the two disagree, so the psql audit and
-- the admin screen can never classify the same row differently.
--
-- How to read `reason`:
--   * 'unknown_order'       -> the reference pointed at no order, or the order
--                              was deleted. Needs a human; no automatic fix.
--   * 'approved_not_paid'   -> the gateway approved the charge and the order
--                              is NOT paid. This is the one that costs money:
--                              the customer was charged and we never delivered
--                              the state. Reconcile against the gateway.
--   * 'declined_still_open' -> the gateway declined and the order is still
--                              awaiting payment. Usually harmless (the
--                              customer retried), worth a glance in bulk.
--   * 'amount_mismatch'     -> the charged amount and the order total disagree.
--                              Never apply this automatically.
--
-- An empty result means every stored event agrees with its order, and the
-- migration's blanket stamp is provably accurate.

select
  e.id as event_id_pk,
  e.provider,
  e.event_id,
  e.status as gateway_status,
  e.reference,
  e.amount_in_cents,
  e.received_at,
  -- Read through to_jsonb so this query also runs BEFORE
  -- 20260919000200 adds the column, which is exactly when the audit matters
  -- most: a missing key reads as NULL instead of raising 42703.
  to_jsonb(e) ->> 'applied_at' as applied_at,
  o.id as order_id,
  o.short_code,
  o.status as order_status,
  o.payment_status,
  o.total,
-- codegen:begin(classification)
case
    when o.id is null
      then 'unknown_order'
    when e.amount_in_cents is not null
      and e.amount_in_cents <> round(o.total * 100)
      then 'amount_mismatch'
    when e.status = 'APPROVED' and o.payment_status <> 'paid'
      then 'approved_not_paid'
    when e.status in ('DECLINED', 'ERROR') and o.payment_status = 'pending'
      then 'declined_still_open'
  end
-- codegen:end(classification)
    as reason
from public.payment_events e
left join public.orders o on o.id = e.order_id
where
-- codegen:begin(filter)
(o.id is null)
  or (e.amount_in_cents is not null
      and e.amount_in_cents <> round(o.total * 100))
  or (e.status = 'APPROVED' and o.payment_status <> 'paid')
  or (e.status in ('DECLINED', 'ERROR') and o.payment_status = 'pending')
-- codegen:end(filter)
order by
  -- Money first: an approved charge with an unpaid order is the expensive
  -- case, and the oldest one has been wrong the longest.
  case
    when e.status = 'APPROVED' and (o.id is null or o.payment_status <> 'paid')
      then 0
    else 1
  end,
  e.received_at;
