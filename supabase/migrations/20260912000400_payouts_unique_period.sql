-- Generating payouts twice for the same store and period must not double a
-- settlement. The application already treats a unique violation here as
-- "already generated" and counts it as skipped instead of failing.
alter table public.payouts
  add constraint payouts_store_period_key unique (store_id, period_start, period_end);
