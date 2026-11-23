-- Courier approval: identity and vehicle on file, approved by an admin,
-- before the order pool opens.
--
-- Until now anyone could sign up as a courier and immediately see and take
-- every ready delivery in the city, cash ones included. A courier carries
-- other people's food and, on cash orders, their money, so the pool now opens
-- only to an approved courier whose papers are current:
--
--   * `courier_profiles` holds the vehicle, plate, identity document and the
--     expiry of the driving licence and SOAT, plus the review status;
--   * `is_active_courier()` is the rule (approved, and a motorised courier's
--     licence and SOAT valid today in Bogotá), mirrored in
--     lib/couriers/profile.ts and compared by tests/couriers-sql-drift.test.ts;
--   * the two order policies that open the pool use it instead of the bare
--     role. Orders already assigned to a courier stay theirs to finish, even
--     if they are suspended or a document expires mid-delivery.
--
-- Couriers who signed up before this have no profile yet, so the pool closes
-- for them until they complete it and an admin approves it. Tell them before
-- deploying.
--
-- Privacy (Ley 1581): the document number, plate and dates are personal data
-- collected to verify who delivers. The courier reads their own row and
-- admins read all; nobody else, and no API role can write: the courier's form
-- and the admin's review go through server actions with the service role.
--
-- Additive and reversible: one table, one function, two policies redefined.
-- supabase/rollbacks/20261124000200_courier_profiles.down.sql undoes it.

set lock_timeout = '3s';

-- ---------------------------------------------------------------------------
-- 1. Profiles
-- ---------------------------------------------------------------------------
create table public.courier_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    constraint courier_profiles_status_check check (status in (
-- codegen:begin(courier_statuses)
'pending', 'approved', 'suspended'
-- codegen:end(courier_statuses)
    )),
  vehicle_type text
    constraint courier_profiles_vehicle_check check (vehicle_type is null or vehicle_type in (
-- codegen:begin(vehicle_types)
'motorcycle', 'car', 'bicycle', 'on_foot'
-- codegen:end(vehicle_types)
    )),
  -- Colombian plates: ABC123 (car) or ABC12D (motorcycle).
  plate text
    constraint courier_profiles_plate_check check (plate is null or plate ~ '^[A-Z]{3}[0-9]{2}[0-9A-Z]$'),
  document_number text
    constraint courier_profiles_document_check check (document_number is null or document_number ~ '^[0-9]{5,12}$'),
  city text
    constraint courier_profiles_city_check check (city is null or char_length(city) between 2 and 60),
  zone text
    constraint courier_profiles_zone_check check (zone is null or char_length(zone) <= 80),
  license_expires_on date,
  soat_expires_on date,
  status_note text
    constraint courier_profiles_note_check check (status_note is null or char_length(status_note) <= 300),
  submitted_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Mirror of `missingForApproval`: what must be on file to be approved.
  constraint courier_profiles_approved_complete check (
    status <> 'approved' or (
      vehicle_type is not null
      and document_number is not null
      and city is not null
      and (
        vehicle_type not in (
-- codegen:begin(motorized_vehicles)
'motorcycle', 'car'
-- codegen:end(motorized_vehicles)
        )
        or (plate is not null and license_expires_on is not null and soat_expires_on is not null)
      )
    )
  )
);

create index courier_profiles_status_idx
  on public.courier_profiles (status, submitted_at desc);

-- One courier account per person: otherwise a courier who owes cash could
-- open a second account and start again with a clean ledger.
create unique index courier_profiles_document_key
  on public.courier_profiles (document_number)
  where document_number is not null;

create trigger courier_profiles_set_updated_at
  before update on public.courier_profiles
  for each row execute function public.set_updated_at();

comment on table public.courier_profiles is
  'Courier identity, vehicle and documents, and the admin review that opens the order pool (is_active_courier).';

alter table public.courier_profiles enable row level security;

create policy "courier_profiles: courier reads own"
  on public.courier_profiles for select to authenticated
  using (user_id = auth.uid());

create policy "courier_profiles: admin full access"
  on public.courier_profiles for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.courier_profiles from anon, authenticated;
grant select on public.courier_profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. The rule
-- ---------------------------------------------------------------------------
-- Security definer so RLS on orders can consult the courier's own row
-- without depending on that table's policies; it only ever reads auth.uid().
create or replace function public.is_active_courier()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'America/Bogota')::date;
  v_active boolean;
begin
  if public.user_role_of(auth.uid()) is distinct from 'courier' then
    return false;
  end if;

  select
-- codegen:begin(courier_active)
cp.status = 'approved' and (cp.vehicle_type not in ('motorcycle', 'car') or (cp.license_expires_on >= v_today and cp.soat_expires_on >= v_today))
-- codegen:end(courier_active)
  into v_active
  from public.courier_profiles cp
  where cp.user_id = auth.uid();

  return coalesce(v_active, false);
end;
$$;

revoke all on function public.is_active_courier() from public, anon;
grant execute on function public.is_active_courier() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. The pool opens only to active couriers
-- ---------------------------------------------------------------------------
alter policy "orders: read as customer, owner or courier"
  on public.orders
  using (
    customer_id = auth.uid()
    or public.owns_store(store_id)
    or courier_id = auth.uid()
    or (
      courier_id is null
      and status = 'ready'
      and type = 'delivery'
      and public.is_active_courier()
    )
  );

alter policy "orders: courier claim or advance"
  on public.orders
  using (
    courier_id = auth.uid()
    or (
      courier_id is null
      and status = 'ready'
      and type = 'delivery'
      and public.is_active_courier()
    )
  )
  with check (courier_id = auth.uid());

reset lock_timeout;
