-- Refunds, recorded as bookkeeping.
--
-- Until now `refunded` was reachable only from an inbound Wompi `VOIDED`
-- webhook. A merchant who hands the money back another way — cash across the
-- counter, a transfer, a refund issued from the Wompi dashboard — had no way
-- to say so, and the order, the metrics and the payouts all kept counting a
-- sale that had been reversed.
--
-- Nothing here calls a payment provider. See `lib/refunds/gateway.ts` for
-- why that seam is deliberately empty: Wompi documents `/v1/refunds` under a
-- "(Sandbox)" heading with production availability unstated, voids are
-- documented for CARD transactions only, and PSE/Nequi/Bancolombia Transfer
-- refundability is unverified. This table records what a human already did.
--
-- ---------------------------------------------------------------------------
-- Units
-- ---------------------------------------------------------------------------
-- `amount` is `numeric`, exactly like `orders.total` and `orders.subtotal`:
-- pesos, not cents. `payment_events.amount_in_cents` is the only place in the
-- schema that speaks cents, because that is the gateway's unit, and the two
-- must never be confused.
--
-- ---------------------------------------------------------------------------
-- Full refunds only
-- ---------------------------------------------------------------------------
-- `payment_status` has no partial state, so a partially refunded order could
-- not be represented. The unique index on `order_id` enforces that today.
-- `amount` is still a column rather than a join to `orders.total`, because it
-- is a snapshot of what was handed back when it was handed back (the same
-- reason `order_items.name_snapshot` exists) — and it means partials will
-- need only that index dropped, not a column added to historical rows.
--
-- ---------------------------------------------------------------------------
-- Generated blocks
-- ---------------------------------------------------------------------------
-- The two `check` lists are emitted by `sqlValueList` in
-- `lib/refunds/vocabulary.ts` and pasted between the `codegen:` markers, the
-- same arrangement `scripts/audit-unapplied-events.sql` uses. Do not
-- hand-edit them: add the value to the vocabulary module and copy the new
-- output in. `tests/refunds-vocabulary-drift.test.ts` compares this file
-- against that module, so a reason the UI offers and the constraint rejects
-- fails the build instead of failing a merchant at the worst moment.

-- Same guard as `20260919000200_payment_events_applied_at.sql`: if another
-- session holds what this file needs, fail fast and let the operator re-run
-- rather than queueing live traffic behind us. The exposure here is small —
-- a new empty table, so the foreign keys validate no rows and the brief lock
-- on `orders` is for the catalogue entry only — this is consistency with the
-- standard that file set, not a rescue. Plain SET, not SET LOCAL, which
-- outside a transaction block is a no-op with a warning.
set lock_timeout = '3s';

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  -- Denormalised from the order so RLS can answer "is this my store?" with
  -- one column instead of a subquery on every row, exactly like payouts.
  store_id uuid not null references public.stores (id) on delete cascade,
  amount numeric not null check (amount > 0),
  -- Vocabulary lives in `lib/refunds/vocabulary.ts`. Text with a check
  -- constraint rather than a PostgreSQL enum: `alter type ... add value`
  -- cannot run inside the transaction `supabase db push` wraps each
  -- migration file in, so a new reason would need its own release dance.
  reason text not null check (
    reason in (
-- codegen:begin(refund_reasons)
'customer_request', 'order_not_delivered', 'duplicate_charge', 'store_cancelled', 'fraud', 'other'
-- codegen:end(refund_reasons)
    )
  ),
  method text not null check (
    method in (
-- codegen:begin(refund_methods)
'cash', 'bank_transfer', 'gateway', 'store_credit', 'other'
-- codegen:end(refund_methods)
    )
  ),
  note text,
  -- `set null` rather than cascade: deleting the profile of whoever issued a
  -- refund must never delete the record that money moved.
  issued_by uuid references public.profiles (id) on delete set null,
  issued_at timestamptz not null default now(),
  -- The payout that carried this refund's negative adjustment, or NULL while
  -- it is still owed. See `lib/payouts/reversal.ts`: a settled payout row is
  -- never mutated, so the reversal rides in the next generated period and
  -- this column is what stops it being carried twice.
  reversed_in_payout_id uuid references public.payouts (id) on delete set null,
  created_at timestamptz not null default now()
);

-- One refund per order: full refunds only, and the second line of defence
-- against two clicks racing each other past the application check.
create unique index refunds_order_id_key on public.refunds (order_id);

create index refunds_store_issued_idx
  on public.refunds (store_id, issued_at desc);

-- Payout generation asks only for refunds still owing an adjustment, and
-- those are the rare minority, so the index is partial.
create index refunds_pending_reversal_idx
  on public.refunds (store_id)
  where reversed_in_payout_id is null;

comment on table public.refunds is
  'Bookkeeping record that money was returned to a customer. Written by hand '
  'from the merchant or admin UI; no payment gateway is called.';

comment on column public.refunds.amount is
  'Pesos, matching orders.total — never cents.';

comment on column public.refunds.reversed_in_payout_id is
  'The payout whose totals carried this refund''s negative adjustment. NULL '
  'means the reversal has not been settled yet.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- Same shape as payouts: admins do everything, a store owner reads their own
-- store's rows and nothing else, everybody else sees nothing. Writes go
-- through the service role after the server action has re-authenticated and
-- checked ownership, so there is deliberately no owner INSERT policy: a
-- refund is not something a browser session gets to create directly.
alter table public.refunds enable row level security;

-- `20260910000400_rls.sql` granted `on all tables in schema public`, which is
-- a snapshot of the tables that existed then. Supabase's bootstrap default
-- privileges do cover new tables, but this table holds money records and is
-- not the place to depend on that: RLS above is what actually gates access,
-- and the grant only decides whether the role reaches RLS at all.
grant select, insert, update, delete on public.refunds
  to anon, authenticated, service_role;

create policy "refunds: admin full access"
  on public.refunds for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "refunds: owner read"
  on public.refunds for select to authenticated
  using (public.owns_store(store_id));

reset lock_timeout;
