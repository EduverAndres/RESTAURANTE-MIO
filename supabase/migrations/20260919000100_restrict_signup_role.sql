-- Privilege escalation fix: a signup can never ask for the `admin` role.
--
-- `handle_new_user()` reads `new.raw_user_meta_data`, which is whatever the
-- client sent in the `data` object of `POST /auth/v1/signup`. That endpoint is
-- public and is reachable with the anon key alone, so it bypasses every
-- server action and every zod schema in `lib/validations/auth.ts`: those run
-- in our Next.js process, not in GoTrue. Until this migration, anyone could
-- sign up with `data: { "role": "admin" }`, get an `admin` profile row, have
-- `sync_role_claim()` mirror it into `auth.users.raw_app_meta_data` and so
-- into their JWT, and pass `public.is_admin()` everywhere.
--
-- The accepted list is therefore reduced to the three self-service roles.
-- `admin` is granted only by an existing admin, through an UPDATE on
-- `public.profiles` guarded by `protect_profile_role()` — never at signup.
-- Anything else, `admin` included, silently resolves to `customer`.
--
-- Existing rows are deliberately NOT touched: auto-demoting them could lock
-- the platform owner out. Run `scripts/audit-admins.sql` to review who holds
-- the role today and whether they granted it to themselves.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data ->> 'role';
  resolved_role public.user_role := 'customer';
begin
  -- `admin` is intentionally absent: raw_user_meta_data is client-controlled.
  if requested_role in ('customer', 'merchant', 'courier') then
    resolved_role := requested_role::public.user_role;
  end if;

  insert into public.profiles (id, role, full_name, phone, avatar_url)
  values (
    new.id,
    resolved_role,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
