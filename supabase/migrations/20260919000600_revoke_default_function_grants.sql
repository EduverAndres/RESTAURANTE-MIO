-- Revoke the EXECUTE grants Supabase hands to `anon` and `authenticated` on
-- every function created in `public`.
--
-- `20260919000300` and `20260919000500` both wrote, with the explicit intent
-- of least privilege:
--
--     revoke all on function ... from public;
--     grant execute on function ... to service_role;
--
-- That is correct on stock PostgreSQL, where a new function's only grant is
-- EXECUTE to the PUBLIC pseudo-role.
--
-- It is NOT correct on Supabase. The project bootstrap runs
--
--     alter default privileges in schema public
--       grant all on functions to anon, authenticated, service_role;
--
-- so a function created in `public` is born carrying EXPLICIT grants to `anon`
-- and `authenticated`. `revoke ... from public` removes the PUBLIC grant and
-- leaves those two exactly where they were.
--
-- Verified against the live database immediately after `20260919000500`
-- applied: `has_function_privilege('anon', 'public.record_refund(...)',
-- 'EXECUTE')` returned true for all three functions. All three are
-- `security definer`, so they execute as the owner and bypass RLS. The
-- publishable key that ships to every browser could therefore have called
-- `record_refund` against any order and `generate_payouts` for any period --
-- which is precisely the hole `refunds` was given no owner INSERT policy to
-- prevent.
--
-- `scripts/audit-function-grants.sql` re-checks this after any migration that
-- adds a function, because the default privilege will keep re-granting.
--
-- Idempotent: revoking a privilege a role does not hold is a no-op.

revoke all on function public.consume_rate_limit(text, text, integer)
  from anon, authenticated;

revoke all on function public.record_refund(
  uuid, public.payment_status, numeric, text, text, text, uuid
) from anon, authenticated;

revoke all on function public.generate_payouts(date, date)
  from anon, authenticated;

-- Pre-existing, same class, found by the audit above rather than by this
-- change. `next_short_code` advances a sequence, so a browser could burn
-- order short codes at will. The `generate_short_code` trigger that actually
-- needs it is itself `security definer` and calls it as the owner, so nothing
-- legitimate loses access here.
revoke all on function public.next_short_code() from anon, authenticated;
