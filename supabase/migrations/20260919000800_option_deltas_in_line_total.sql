-- Put option surcharges back into the order subtotal.
--
-- THE BUG. `order_items.line_total` was `generated always as
-- (unit_price * quantity) stored`, and `unit_price` holds only the base
-- catalogue price -- the chosen option surcharges live in the separate
-- `options` JSON. The AFTER trigger `recalc_order_subtotal` then overwrites
-- `orders.subtotal` with the sum of that column, and the BEFORE trigger
-- `compute_order_totals` recomputes `total` from it.
--
-- So for any order carrying a priced option, the database quietly replaced
-- the correct subtotal the application had just written with a smaller one.
-- Measured on this database before the fix: five orders diverged by 54,000
-- COP in total, the worst by 22,000.
--
-- Three things were wrong at once:
--   * the merchant was settled short -- `generate_payouts` reads `subtotal`
--     and `platform_fee`, both derived from the lowered figure;
--   * the Wompi webhook compares `transaction.amount_in_cents` against
--     `round(orders.total * 100)`. The gateway charged the quoted amount, the
--     row held the lowered one, so the event was classified `amount_mismatch`
--     and never applied: the customer paid and the order stayed unpaid;
--   * it could not self-heal, because every later UPDATE re-ran the same
--     arithmetic.
--
-- THE FIX. Keep `line_total` generated -- a generated column cannot drift
-- from its inputs, which is worth more than the flexibility of a plain one --
-- but give it the surcharge as an explicit column the application writes.
--
-- `options_delta` is signed on purpose: an option group may price a choice
-- below the base (a smaller size), and `lib/pricing.ts#optionsDelta` already
-- sums negatives.

set lock_timeout = '3s';

-- Nullable-free from the start: every existing row gets 0, and the backfill
-- below replaces that with the real figure. A non-volatile default means
-- PostgreSQL stores it as a per-attribute "missing value" rather than
-- rewriting the table.
alter table public.order_items
  add column options_delta numeric not null default 0;

comment on column public.order_items.options_delta is
  'Sum of the chosen options'' price_delta for this line, signed. Written by '
  'lib/orders/build-order.ts#orderItemRows; line_total is generated from it.';

-- A generated column's expression cannot be altered in place, so the column
-- is dropped and recreated. Nothing is lost: every value in it was derived.
alter table public.order_items
  drop column line_total;

alter table public.order_items
  add column line_total numeric
    generated always as ((unit_price + options_delta) * quantity) stored;

-- Backfill from the JSON that was already being stored, so history becomes
-- true rather than merely stopping getting worse.
--
-- This UPDATE fires `order_items_recalc_subtotal`, which recomputes
-- `orders.subtotal` from the now-correct `line_total`, which in turn fires
-- `compute_order_totals` to fix `orders.total`. That is the intent: an order
-- whose stored total disagreed with what the gateway charged now agrees, and
-- a Wompi event that was parked as `amount_mismatch` can be re-applied.
--
-- Two consequences to know rather than discover:
--   * `compute_order_totals` re-reads `stores.commission_pct` LIVE, so a
--     store whose commission changed since an order was placed will have that
--     order's `platform_fee` recomputed at the current rate. That is a
--     pre-existing behaviour of the trigger, not something introduced here.
--   * Payout rows already written are immutable and are NOT revisited. A
--     merchant settled short on an affected order stays short until an
--     adjustment is made deliberately; correcting a settled payout would put
--     the books out of step with the transfer that really happened.
update public.order_items oi
set options_delta = coalesce((
  select sum((opt ->> 'price_delta')::numeric)
  from jsonb_array_elements(oi.options) opt
  where jsonb_typeof(opt -> 'price_delta') = 'number'
), 0)
where jsonb_typeof(oi.options) = 'array'
  and jsonb_array_length(oi.options) > 0;

reset lock_timeout;
