-- Table reservations: a customer asks for a date, a time and a party size;
-- the restaurant confirms or declines from its panel, then marks the guests
-- as arrived or not. No deposit.
--
-- Capacity is a pace: a slot (every `slot_minutes`) accepts up to
-- `covers_per_slot` guests whose reservation STARTS inside it. Pending,
-- confirmed and seated reservations hold covers. The slot grid, opening
-- hours (including windows past midnight) and plan gating are decided on the
-- server by lib/reservations/slots.ts, the same code that draws the grid in
-- the browser; everything that can race (capacity, notice, horizon, blocked
-- dates, duplicates, the per-customer limit) is decided here, atomically,
-- by `create_reservation`, which locks the store's settings row.
--
-- Status changes are made by the server only (service role, compare-and-set
-- on the current status); `guard_reservation_update` refuses any transition
-- outside the allowed pairs (lib/reservations/transitions.ts) and keeps the
-- booking itself immutable.
--
-- Privacy (Ley 1581): the contact name and phone exist only to honour the
-- booking. The customer, the store owner and admins can read a reservation;
-- anon never can. Rows go with the customer's account (on delete cascade).
--
-- Additive and reversible: two tables, two functions, one trigger and a
-- realtime publication entry.
-- supabase/rollbacks/20261124000400_reservations.down.sql undoes it.

set lock_timeout = '3s';

-- ---------------------------------------------------------------------------
-- 1. Settings, per store
-- ---------------------------------------------------------------------------
create table public.reservation_settings (
  store_id uuid primary key references public.stores (id) on delete cascade,
  enabled boolean not null default false,
  slot_minutes smallint not null default 30
    check (slot_minutes in (15, 30, 60)),
  covers_per_slot smallint not null default 20
    check (covers_per_slot between 1 and 500),
  max_party_size smallint not null default 8
    check (max_party_size between 1 and 50),
  min_lead_minutes integer not null default 120
    check (min_lead_minutes between 0 and 10080),
  max_days_ahead smallint not null default 30
    check (max_days_ahead between 1 and 90),
  duration_minutes smallint not null default 90
    check (duration_minutes between 30 and 360),
  policy_text text not null default ''
    check (char_length(policy_text) <= 280),
  blocked_dates date[] not null default '{}'
    check (cardinality(blocked_dates) <= 60),
  updated_at timestamptz not null default now()
);

create trigger reservation_settings_set_updated_at
  before update on public.reservation_settings
  for each row execute function public.set_updated_at();

comment on table public.reservation_settings is
  'How a store takes reservations. Written by the server (plan-gated); read by anyone to draw the booking grid.';

alter table public.reservation_settings enable row level security;

create policy "reservation_settings: public read"
  on public.reservation_settings for select to anon, authenticated
  using (true);

create policy "reservation_settings: admin full access"
  on public.reservation_settings for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.reservation_settings from anon, authenticated;
grant select on public.reservation_settings to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Reservations
-- ---------------------------------------------------------------------------
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  code text not null default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  store_id uuid not null references public.stores (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  -- The service a late slot belongs to: Friday's 01:00 is Friday's service.
  service_date date not null,
  party_size smallint not null check (party_size between 1 and 50),
  status text not null default 'pending'
    constraint reservations_status_check check (status in (
-- codegen:begin(reservation_statuses)
'pending', 'confirmed', 'declined', 'cancelled', 'seated', 'no_show'
-- codegen:end(reservation_statuses)
    )),
  contact_name text not null
    check (char_length(contact_name) between 2 and 80),
  contact_phone text not null
    check (contact_phone ~ '^\+?[0-9]{7,15}$'),
  occasion text
    constraint reservations_occasion_check check (occasion is null or occasion in (
-- codegen:begin(reservation_occasions)
'birthday', 'anniversary', 'date', 'business', 'celebration', 'other'
-- codegen:end(reservation_occasions)
    )),
  notes text check (notes is null or char_length(notes) <= 300),
  decline_reason text
    check (decline_reason is null or char_length(decline_reason) <= 200),
  cancel_reason text
    check (cancel_reason is null or char_length(cancel_reason) <= 200),
  cancelled_by text
    check (cancelled_by is null or cancelled_by in ('customer', 'store', 'admin')),
  confirmed_at timestamptz,
  declined_at timestamptz,
  cancelled_at timestamptz,
  seated_at timestamptz,
  no_show_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservations_code_key unique (store_id, code),
  constraint reservations_cancel_shape
    check ((status = 'cancelled') = (cancelled_by is not null)),
  constraint reservations_decline_reason
    check (status <> 'declined' or decline_reason is not null)
);

-- Capacity checks and the Today / Upcoming views.
create index reservations_store_active_idx
  on public.reservations (store_id, starts_at)
  where status in ('pending', 'confirmed', 'seated');

create index reservations_store_service_idx
  on public.reservations (store_id, service_date desc);

create index reservations_customer_idx
  on public.reservations (customer_id, starts_at desc);

-- One live booking per customer, store and service.
create unique index reservations_one_per_day
  on public.reservations (store_id, customer_id, service_date)
  where status in (
-- codegen:begin(active_statuses_index)
'pending', 'confirmed'
-- codegen:end(active_statuses_index)
  );

comment on table public.reservations is
  'Table bookings. Created by create_reservation (service role); moved through statuses by the server only.';

alter table public.reservations enable row level security;

create policy "reservations: customer read own"
  on public.reservations for select to authenticated
  using (customer_id = auth.uid());

create policy "reservations: owner read"
  on public.reservations for select to authenticated
  using (public.owns_store(store_id));

create policy "reservations: admin full access"
  on public.reservations for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.reservations from anon, authenticated;
grant select on public.reservations to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Status changes
-- ---------------------------------------------------------------------------
create or replace function public.guard_reservation_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.store_id <> old.store_id
    or new.customer_id <> old.customer_id
    or new.starts_at <> old.starts_at
    or new.service_date <> old.service_date
    or new.party_size <> old.party_size
    or new.created_at <> old.created_at
    or new.code <> old.code
  then
    raise exception 'a reservation''s booking cannot change'
      using errcode = 'check_violation';
  end if;

  if new.status <> old.status then
    if (old.status, new.status) not in (
-- codegen:begin(reservation_transitions)
('pending', 'confirmed'), ('pending', 'declined'), ('pending', 'cancelled'), ('confirmed', 'cancelled'), ('pending', 'seated'), ('confirmed', 'seated'), ('confirmed', 'no_show'), ('no_show', 'seated'), ('seated', 'confirmed')
-- codegen:end(reservation_transitions)
    ) then
      raise exception 'reservation cannot go from % to %', old.status, new.status
        using errcode = 'check_violation';
    end if;

    -- Stamp the state entered; clear the one left on an undo.
    case new.status
      when 'confirmed' then
        new.confirmed_at := coalesce(old.confirmed_at, now());
        new.seated_at := null;
      when 'declined' then new.declined_at := now();
      when 'cancelled' then new.cancelled_at := now();
      when 'seated' then
        new.seated_at := now();
        new.no_show_at := null;
      when 'no_show' then new.no_show_at := now();
      else null;
    end case;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger reservations_guard_update
  before update on public.reservations
  for each row execute function public.guard_reservation_update();

revoke all on function public.guard_reservation_update() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Booking, atomically
-- ---------------------------------------------------------------------------
create or replace function public.create_reservation(
  p_store_id uuid,
  p_customer_id uuid,
  p_starts_at timestamptz,
  p_service_date date,
  p_party_size integer,
  p_contact_name text,
  p_contact_phone text,
  p_occasion text,
  p_notes text,
  p_max_active integer
)
returns table (outcome text, reservation_id uuid, code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.reservation_settings%rowtype;
  v_store_status public.store_status;
  v_booked integer;
  v_id uuid;
  v_code text;
begin
  -- Serialises every booking of this store: two people cannot both take the
  -- last covers of a slot.
  select * into v_settings
  from public.reservation_settings s
  where s.store_id = p_store_id
  for update;

  select s.status into v_store_status from public.stores s where s.id = p_store_id;

  if not found or v_settings.store_id is null or not v_settings.enabled
    or v_store_status is distinct from 'active' then
    return query select 'disabled'::text, null::uuid, null::text;
    return;
  end if;

  if p_service_date = any (v_settings.blocked_dates) then
    return query select 'closed'::text, null::uuid, null::text;
    return;
  end if;

  if p_party_size > v_settings.max_party_size then
    return query select 'too_large'::text, null::uuid, null::text;
    return;
  end if;

  if p_starts_at < now() + make_interval(mins => v_settings.min_lead_minutes) then
    return query select 'too_soon'::text, null::uuid, null::text;
    return;
  end if;

  if p_starts_at > now() + make_interval(days => v_settings.max_days_ahead + 1) then
    return query select 'too_far'::text, null::uuid, null::text;
    return;
  end if;

  if (
    select count(*)
    from public.reservations r
    where r.customer_id = p_customer_id
      and r.starts_at > now()
      and r.status in (
-- codegen:begin(active_statuses_limit)
'pending', 'confirmed'
-- codegen:end(active_statuses_limit)
      )
  ) >= p_max_active then
    return query select 'limit'::text, null::uuid, null::text;
    return;
  end if;

  if exists (
    select 1
    from public.reservations r
    where r.store_id = p_store_id
      and r.customer_id = p_customer_id
      and r.service_date = p_service_date
      and r.status in (
-- codegen:begin(active_statuses_duplicate)
'pending', 'confirmed'
-- codegen:end(active_statuses_duplicate)
      )
  ) then
    return query select 'duplicate'::text, null::uuid, null::text;
    return;
  end if;

  -- Mirror of the capacity rule in lib/reservations/slots.ts.
  select coalesce(sum(r.party_size), 0) into v_booked
  from public.reservations r
  where r.store_id = p_store_id
    and r.status in (
-- codegen:begin(holding_statuses)
'pending', 'confirmed', 'seated'
-- codegen:end(holding_statuses)
    )
    and r.starts_at >= p_starts_at
    and r.starts_at < p_starts_at + make_interval(mins => v_settings.slot_minutes);

  if v_booked + p_party_size > v_settings.covers_per_slot then
    return query select 'full'::text, null::uuid, null::text;
    return;
  end if;

  insert into public.reservations (
    store_id, customer_id, starts_at, service_date, party_size,
    contact_name, contact_phone, occasion, notes
  )
  values (
    p_store_id, p_customer_id, p_starts_at, p_service_date, p_party_size,
    p_contact_name, p_contact_phone, nullif(p_occasion, ''), nullif(p_notes, '')
  )
  returning id, reservations.code into v_id, v_code;

  return query select 'ok'::text, v_id, v_code;
exception
  when unique_violation then
    -- The partial unique index: a duplicate that slipped past the check.
    return query select 'duplicate'::text, null::uuid, null::text;
end;
$$;

revoke all on function public.create_reservation(uuid, uuid, timestamptz, date, integer, text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.create_reservation(uuid, uuid, timestamptz, date, integer, text, text, text, text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Realtime for the store's board and the customer's list
-- ---------------------------------------------------------------------------
-- Row-level RLS above decides who receives each change.
alter publication supabase_realtime add table public.reservations;

reset lock_timeout;
