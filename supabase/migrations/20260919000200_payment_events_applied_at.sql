-- Stop silently losing payments: record whether a stored event was actually
-- applied to its order.
--
-- Until now the unique constraint on (provider, event_id, status) was the
-- only thing the handler looked at, so an event whose orders-UPDATE failed
-- was still "stored". Wompi's retry then hit the constraint, was reported as
-- a duplicate and short-circuited, leaving the customer charged and the order
-- `pending` forever.
--
-- `applied_at` is the missing half of that check: it is stamped only after the
-- order has really moved, so a replay of a row that is still NULL re-applies
-- instead of short-circuiting.
--
-- ---------------------------------------------------------------------------
-- Why there is no CREATE INDEX CONCURRENTLY here
-- ---------------------------------------------------------------------------
-- `payment_events` is the table the live webhook inserts into, so everything
-- below takes an ACCESS EXCLUSIVE lock that blocks inbound notifications
-- while it runs. The usual answer, CREATE INDEX CONCURRENTLY, is not
-- available here: migrations are applied with `npm run db:push` ->
-- `scripts/db.mjs push` -> `supabase db push`, which applies each migration
-- file inside a transaction together with its `schema_migrations` bookkeeping
-- so a failed migration rolls back cleanly, and PostgreSQL refuses
-- CONCURRENTLY inside a transaction block. Moving it to a file of its own
-- would not help: the runner wraps every file the same way.
--
-- This file must therefore contain no explicit BEGIN/COMMIT either — nesting
-- one inside the runner's transaction would commit it early and leave the
-- bookkeeping insert outside it.
--
-- So the lock cannot be avoided; it is made short instead. Every statement
-- below is O(1) in the size of the table, so the window is microseconds
-- rather than proportional to months of stored events.

-- Never queue the live webhook behind a lock we may not even get. If another
-- session is holding `payment_events`, fail fast and let the operator re-run,
-- rather than stacking every inbound notification behind us. Plain SET, not
-- SET LOCAL, because SET LOCAL outside a transaction block is a no-op with a
-- warning and this file must behave the same either way; it is reset below
-- and the migration connection is torn down straight after in any case.
set lock_timeout = '3s';

-- The backfill and the column are one statement on purpose.
--
-- Everything received before this migration ran through a handler that
-- answered 200 for a failed apply, so it cannot be distinguished from a real
-- success any more. Treating history as applied is the right default: the
-- alternative is letting a future replay re-run months of events. It does
-- mean an event that genuinely never applied is stamped along with the rest,
-- so `scripts/audit-unapplied-events.sql` lists the orders that assumption
-- may be covering for. Run it BEFORE applying this migration — afterwards the
-- `applied_at IS NULL` signal no longer exists to be found.
--
-- Written as `update ... where applied_at is null` this would rewrite every
-- row while holding the lock. Since PostgreSQL 11 a new column whose default
-- is non-volatile is stored once as a per-attribute "missing value" and no
-- existing row is touched at all; `now()` is STABLE, so it qualifies. The
-- rows therefore read back as applied with no table rewrite, and NOT NULL
-- proves none was missed.
alter table public.payment_events
  add column applied_at timestamptz not null default now();

-- The default and the NOT NULL existed only to stamp history in one shot.
-- From here on `applied_at` stays NULL until the handler has really moved the
-- order, which is the entire point of the column. Both are catalogue-only
-- changes.
alter table public.payment_events
  alter column applied_at drop default,
  alter column applied_at drop not null;

-- Supports both the replay check (one row by its unique key) and the
-- operational query "which events were received and never reflected on an
-- order?" — a partial index, because applied rows are the overwhelming
-- majority and are never looked up this way.
--
-- Built last deliberately: the statement above stamped every existing row, so
-- this predicate now matches zero rows and the build is immediate. That is
-- what makes CONCURRENTLY unnecessary here rather than merely unavailable.
create index payment_events_unapplied_idx
  on public.payment_events (received_at)
  where applied_at is null;

comment on column public.payment_events.applied_at is
  'When the event outcome was written to the order. NULL means received but '
  'never applied: either a retryable failure Wompi will redeliver, or an '
  'event that needs a human (unknown order, amount mismatch).';

reset lock_timeout;
