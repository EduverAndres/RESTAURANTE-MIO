-- Mirror profiles.role into auth.users.raw_app_meta_data->'role' so the
-- middleware can authorise requests from the JWT (user.app_metadata.role)
-- without a database roundtrip. app_metadata cannot be edited by end users.

create or replace function public.sync_role_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update auth.users
  set raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', new.role)
  where id = new.id
    and coalesce(raw_app_meta_data ->> 'role', '') is distinct from new.role::text;

  return new;
end;
$$;

revoke all on function public.sync_role_claim() from public;

drop trigger if exists profiles_sync_role_claim on public.profiles;
create trigger profiles_sync_role_claim
  after insert or update of role on public.profiles
  for each row execute function public.sync_role_claim();

-- One-time backfill for users created before this migration.
update auth.users u
set raw_app_meta_data =
  coalesce(u.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', p.role)
from public.profiles p
where p.id = u.id
  and coalesce(u.raw_app_meta_data ->> 'role', '') is distinct from p.role::text;
