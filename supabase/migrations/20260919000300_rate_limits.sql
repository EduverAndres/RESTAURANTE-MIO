-- Shared rate-limit counters.
--
-- Why a table and not a process-local map: every request is a fresh Vercel
-- invocation and may land on a different instance, so an in-memory counter
-- limits one lambda and nothing else. The counter has to be somewhere all
-- instances can see, and this database already is that place. The
-- application talks to it through `lib/rate-limit/store.ts`, which is a
-- one-method interface precisely so a future Redis backend is one new file.
--
-- One row per (bucket, identifier) holding a fixed window. `bucket` names
-- the budget (`table_order`, `table_order_ip`, …) and `identifier` is an
-- opaque hash — never a QR token, never an email; see `rateLimitIdentifier`.

create table public.rate_limits (
  bucket text not null,
  identifier text not null,
  window_start timestamptz not null default now(),
  hit_count integer not null default 0,
  primary key (bucket, identifier)
);

-- The primary key already serves the check itself: `consume_rate_limit`
-- touches exactly one row, found by (bucket, identifier), so the whole limit
-- decision is one index lookup. This second index exists only for the
-- cleanup sweep below, which scans by age.
create index rate_limits_window_start_idx on public.rate_limits (window_start);

comment on table public.rate_limits is
  'Fixed-window rate-limit counters, written only by public.consume_rate_limit. '
  'Rows are disposable: dropping the table loses nothing but the current windows.';

-- No policies on purpose. Nothing but the security definer function below
-- (and the service role, which bypasses RLS) has any business reading these
-- counters, and RLS with zero policies denies everyone else by default.
alter table public.rate_limits enable row level security;

-- Records one hit and returns the resulting counter.
--
-- ---------------------------------------------------------------------------
-- Why this is one statement
-- ---------------------------------------------------------------------------
-- The obvious implementation — SELECT the count, decide, UPDATE it — is
-- wrong under concurrency: two requests arriving together both read the same
-- count, both conclude they are under the limit, and both pass a limit of 1.
-- No amount of application-side care fixes that; the read and the write are
-- two statements with a gap in between.
--
-- `insert ... on conflict do update` has no such gap. When the row already
-- exists PostgreSQL takes a row-level lock before applying the update, so
-- concurrent callers are serialised on that row and each one sees the count
-- the previous caller left: they come back with 1 and 2, never 1 and 1. The
-- window rollover is folded into the same statement as a CASE, so even the
-- "is this window still current?" question is never asked separately.
--
-- The counter is incremented for denied hits too. That is intentional: a
-- caller that keeps hammering keeps the window full rather than trickling
-- through one request per window boundary. The window itself still expires
-- `p_window_seconds` after it opened, so a limited caller is never locked
-- out for longer than one window.
create or replace function public.consume_rate_limit(
  p_bucket text,
  p_identifier text,
  p_window_seconds integer
)
returns table (hit_count integer, window_start timestamptz)
language sql
security definer
set search_path = public
as $$
  -- Cleanup, so the table cannot grow forever. Rows are only interesting
  -- until their window closes, and the longest window any caller uses is
  -- minutes, so anything older than an hour is certainly dead.
  --
  -- Done here rather than on a schedule because this project has no job
  -- runner, and bounded to 20 rows so the cost is constant: with the index
  -- above, an empty sweep is a single index probe and a busy one deletes at
  -- most 20 rows. `skip locked` means two concurrent callers sweeping at the
  -- same time pick different rows instead of deadlocking on each other.
  --
  -- If this ever proves too lazy under real traffic, the periodic equivalent
  -- is simply:
  --     delete from public.rate_limits where window_start < now() - interval '1 hour';
  -- run from pg_cron; the sweep below can then be dropped.
  delete from public.rate_limits r
  where r.ctid = any (array(
    select c.ctid
    from public.rate_limits c
    where c.window_start < now() - interval '1 hour'
    order by c.window_start
    limit 20
    for update skip locked
  ));

  insert into public.rate_limits as l (bucket, identifier, window_start, hit_count)
  values (p_bucket, p_identifier, now(), 1)
  on conflict (bucket, identifier) do update
    set hit_count = case
          when l.window_start + make_interval(secs => p_window_seconds) <= now()
            then 1
          else l.hit_count + 1
        end,
        window_start = case
          when l.window_start + make_interval(secs => p_window_seconds) <= now()
            then now()
          else l.window_start
        end
  returning l.hit_count, l.window_start;
$$;

-- Least privilege: unlike `resolve_store_table`, no browser-facing role ever
-- calls this. Only trusted server code holding the service-role key does, so
-- `anon` and `authenticated` get nothing — a guest that could call it
-- directly could burn its own budget, or anyone else's, at will.
revoke all on function public.consume_rate_limit(text, text, integer) from public;
grant execute on function public.consume_rate_limit(text, text, integer) to service_role;
