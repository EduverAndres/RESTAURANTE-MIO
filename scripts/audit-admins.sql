-- Read-only audit of every platform administrator.
--
-- Before `20260919000100_restrict_signup_role.sql`, `handle_new_user()`
-- accepted a `role` taken straight from `raw_user_meta_data`, which the
-- client controls on the public `/auth/v1/signup` endpoint. Any account
-- created that way is a self-granted admin.
--
-- `signup_requested_role` is what the account asked for when it was created:
--   * 'admin'              -> self-granted at signup, almost certainly an
--                             escalation; verify with the owner and demote.
--   * NULL / another role  -> the role was granted later through an UPDATE on
--                             public.profiles, which `protect_profile_role()`
--                             only lets an existing admin (or a session-less
--                             service-role job, such as the seed) perform.
--
-- Nothing here writes. Run it with a service-role connection:
--   psql "$SUPABASE_DB_URL" -f scripts/audit-admins.sql

select
  p.id,
  u.email,
  p.full_name,
  p.role,
  u.created_at as auth_created_at,
  p.created_at as profile_created_at,
  u.raw_user_meta_data ->> 'role' as signup_requested_role,
  u.raw_app_meta_data ->> 'role' as jwt_role_claim,
  u.last_sign_in_at
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'admin'
order by u.created_at;
