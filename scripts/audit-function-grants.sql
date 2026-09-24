-- Read-only audit: which `security definer` functions in `public` can the
-- browser-facing roles call as RPC?
--
-- Run this after ANY migration that creates a function. Supabase's bootstrap
-- keeps `alter default privileges in schema public grant all on functions to
-- anon, authenticated, service_role` in force, so every new function is born
-- executable by the publishable key. A `revoke ... from public` in the
-- migration does NOT undo it: PUBLIC and the explicit role grants are
-- different things. That is the bug
-- `20260919000600_revoke_default_function_grants.sql` exists to fix, and the
-- default privilege will keep re-granting for every function added after it.
--
-- There are TWO paths and closing one does nothing about the other:
--   1. the PUBLIC pseudo-role -- the empty-grantee `=X/...` entry in proacl;
--   2. explicit grants to `anon` and `authenticated`.
-- Always write `revoke all on function <sig> from public, anon, authenticated;`
-- as one statement. Revoking either half alone leaves the function open, which
-- is how this was missed twice -- see `20260919000700`.
--
-- A `security definer` function runs as its owner and bypasses RLS, so a row
-- here is a path from the browser to owner privileges.
--
-- Two classes are excluded on purpose, because they would make this audit
-- cry wolf and nobody reads an alarm that always rings:
--
--   * Trigger functions. PostgREST does not expose a function returning
--     `trigger` as an RPC endpoint, so the grant is unreachable.
--   * The RLS helper predicates in `intentional` below. RLS policies evaluate
--     as the CALLING role, so `anon` must be able to execute them or every
--     policy that uses one fails closed. They are read-only predicates that
--     answer a question the caller is already entitled to ask.
--
-- Keep `intentional` honest: add a name only when the browser genuinely must
-- reach it, and say why. Anything not listed is a finding.
--
-- Nothing here writes. Run it with a service-role connection:
--   psql "$SUPABASE_DB_URL" -f scripts/audit-function-grants.sql
--
-- An empty result means no unexpected `security definer` function in `public`
-- is reachable from the browser.

with intentional(name, reason) as (
  values
    ('can_edit_order_items', 'RLS predicate on order_items'),
    ('is_admin',             'RLS predicate, reads the caller own role claim'),
    ('next_short_code',      'column default on orders.short_code: a DEFAULT runs as the inserting role, so anon/authenticated must execute it or no order can be placed (20260919000900)'),
    ('option_store_id',      'RLS predicate, resolves an option to its store'),
    ('owns_store',           'RLS predicate on every store-scoped table'),
    ('owns_store_folder',    'RLS predicate on storage objects'),
    ('product_store_id',     'RLS predicate, resolves a product to its store'),
    ('resolve_store_table',  'public QR table flow: slug + token is the credential'),
    ('store_is_visible',     'RLS predicate for anonymous storefront reads'),
    ('user_role_of',         'RLS predicate, resolves a uid to its role')
)
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  r.rolname as role_with_execute,
  -- A definer function with no pinned search_path is a second, separate
  -- problem: the caller controls name resolution inside the body.
  (p.proconfig is null
    or not exists (
      select 1 from unnest(p.proconfig) c where c like 'search\_path=%'
    )
  ) as search_path_unpinned
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join (values ('anon'), ('authenticated')) as r(rolname)
where n.nspname = 'public'
  and p.prosecdef
  and p.prorettype <> 'trigger'::regtype
  and p.proname not in (select name from intentional)
  and has_function_privilege(r.rolname, p.oid, 'EXECUTE')
order by p.proname, r.rolname;
