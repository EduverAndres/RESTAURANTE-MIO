-- Read-only audit of money state that disagrees with itself.
--
-- `20260919000500_money_transactions.sql` moved both money paths into single
-- transactions, so nothing below can be *created* any more. This script
-- exists for the rows that were created before it — and as the standing
-- answer to "is the ledger still consistent?", the same way
-- `scripts/audit-unapplied-events.sql` keeps answering its question after the
-- migration that prompted it.
--
-- Run it once BEFORE applying that migration (to see what history left
-- behind) and afterwards whenever a payout period looks wrong. Nothing here
-- writes. Use a service-role connection:
--   psql "$SUPABASE_DB_URL" -f scripts/audit-refund-consistency.sql
--
-- An empty result means every refund agrees with its order and every pending
-- clawback is still genuinely owed.
--
-- How to read `finding`:
--
--   * 'refund_without_refunded_order'
--       A refund row exists and the order does NOT read `refunded`. This is
--       the orphan the old two-write refund path could leave when its
--       compensating DELETE also failed. It costs money in silence: payout
--       generation settles the sale in full (the eligibility rule only drops
--       orders whose `payment_status` is `refunded`) and the refund produces
--       no clawback, because it predates every payout for that store.
--       Fix: decide which record is true. If the money really went back,
--       move the order to `refunded`; if it did not, delete the refund row.
--       Both are one statement, and neither is safe to automate.
--
--   * 'refunded_order_without_refund'
--       The order reads `refunded` and no refund row exists. Usually NOT a
--       defect: an inbound Wompi `VOIDED` webhook moves the order directly
--       (see `lib/payments/wompi/apply-status.ts`) and writes no bookkeeping
--       row, because no human handed money back. Listed because payout
--       reversals are driven by `refunds`, not by `orders.payment_status`, so
--       an order voided AFTER its period was settled owes a clawback nobody
--       will carry. Worth a look when the order was delivered and paid.
--
--   * 'stale_pending_reversal'
--       A refund still waiting to be carried (`reversed_in_payout_id is
--       null`) whose store has had a payout generated SINCE the refund was
--       recorded. Generation stamps every refund it considered, so a refund
--       that survived a later run is either genuinely deferred (its store had
--       no row that period) or the residue of the old bug where the stamp
--       failed after the deduction was applied — the case that debited the
--       merchant for the same refund every period. Check the carrying
--       payout's `gross` against the order: if the deduction is already in
--       there, stamp the refund with that payout's id by hand.
--
-- The three questions are asked over `refunds`, `orders` and `payouts`, all
-- by indexed columns, so this stays cheap as the tables grow.

select * from (

  select
    'refund_without_refunded_order' as finding,
    r.id as refund_id,
    o.id as order_id,
    o.short_code,
    o.status as order_status,
    o.payment_status,
    o.total,
    r.amount as refund_amount,
    r.issued_at,
    r.reversed_in_payout_id
  from public.refunds r
  join public.orders o on o.id = r.order_id
  where o.payment_status <> 'refunded'

  union all

  select
    'refunded_order_without_refund',
    null,
    o.id,
    o.short_code,
    o.status,
    o.payment_status,
    o.total,
    null,
    null,
    null
  from public.orders o
  where o.payment_status = 'refunded'
    and not exists (select 1 from public.refunds r where r.order_id = o.id)

  union all

  select
    'stale_pending_reversal',
    r.id,
    o.id,
    o.short_code,
    o.status,
    o.payment_status,
    o.total,
    r.amount,
    r.issued_at,
    null
  from public.refunds r
  join public.orders o on o.id = r.order_id
  where r.reversed_in_payout_id is null
    and exists (
      select 1
      from public.payouts p
      where p.store_id = r.store_id
        and p.created_at > r.issued_at
    )

) findings
order by
  -- The orphan first: it is the one that is actively mis-settling money.
  case finding
    when 'refund_without_refunded_order' then 0
    when 'stale_pending_reversal' then 1
    else 2
  end,
  issued_at nulls last;
