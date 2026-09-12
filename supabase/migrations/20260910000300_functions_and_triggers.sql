-- Functions and triggers: auth sync, order lifecycle, ratings, geo search
-- and the helpers used by row level security policies.

-- ---------------------------------------------------------------------------
-- Generic updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger stores_set_updated_at
  before update on public.stores
  for each row execute function public.set_updated_at();
create trigger menu_categories_set_updated_at
  before update on public.menu_categories
  for each row execute function public.set_updated_at();
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();
create trigger product_options_set_updated_at
  before update on public.product_options
  for each row execute function public.set_updated_at();
create trigger product_option_values_set_updated_at
  before update on public.product_option_values
  for each row execute function public.set_updated_at();
create trigger addresses_set_updated_at
  before update on public.addresses
  for each row execute function public.set_updated_at();
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();
create trigger payouts_set_updated_at
  before update on public.payouts
  for each row execute function public.set_updated_at();
create trigger courier_locations_set_updated_at
  before update on public.courier_locations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS helpers (security definer so policies can read across tables safely)
-- ---------------------------------------------------------------------------

-- Role of the given user, or null when the user has no profile.
create or replace function public.user_role_of(uid uuid)
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = uid;
$$;

-- True when the current request belongs to an admin profile.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.user_role_of(auth.uid()) = 'admin', false);
$$;

-- True when the current user owns the store.
create or replace function public.owns_store(store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.stores s
    where s.id = owns_store.store_id
      and s.owner_id = auth.uid()
  );
$$;

-- True when the store can be browsed by the current request: it is active,
-- it belongs to the current user, or the current user is an admin.
create or replace function public.store_is_visible(store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.stores s
    where s.id = store_is_visible.store_id
      and (s.status = 'active' or s.owner_id = auth.uid())
  ) or public.is_admin();
$$;

-- Store that a product belongs to.
create or replace function public.product_store_id(product_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.store_id from public.products p where p.id = product_store_id.product_id;
$$;

-- Store that a product option belongs to (through its product).
create or replace function public.option_store_id(option_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.store_id
  from public.product_options o
  join public.products p on p.id = o.product_id
  where o.id = option_store_id.option_id;
$$;

-- True when the current request may add or edit items of the given order:
-- the customer (or anonymous table guest) while the order is still pending,
-- the store owner, or an admin.
create or replace function public.can_edit_order_items(order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = can_edit_order_items.order_id
      and (
        (o.status = 'pending' and o.customer_id is not null and o.customer_id = auth.uid())
        or (o.status = 'pending' and o.customer_id is null and o.type = 'table')
        or o.store_id in (select s.id from public.stores s where s.owner_id = auth.uid())
      )
  ) or public.is_admin();
$$;

-- ---------------------------------------------------------------------------
-- Auth: create a profile for every new auth user
-- ---------------------------------------------------------------------------
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
  if requested_role in ('customer', 'merchant', 'courier', 'admin') then
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users cannot promote themselves: only admins (or server-side jobs running
-- without a user session) may change the role column.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only admins can change a profile role'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------------------------------------------------------------------------
-- Stores: merchants cannot set their own commission or activation status
-- ---------------------------------------------------------------------------
create or replace function public.protect_store_admin_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Requests without a user session (service role, migrations, seeds) and
  -- admins may manage these columns freely.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.commission_pct is distinct from 6 or new.status is distinct from 'pending' then
      raise exception 'Only admins can set commission_pct or status'
        using errcode = 'insufficient_privilege';
    end if;
  elsif new.commission_pct is distinct from old.commission_pct
     or new.status is distinct from old.status then
    raise exception 'Only admins can change commission_pct or status'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger stores_protect_admin_columns
  before insert or update on public.stores
  for each row execute function public.protect_store_admin_columns();

-- ---------------------------------------------------------------------------
-- Orders: short codes, totals, status timestamps
-- ---------------------------------------------------------------------------

-- Six characters from an alphabet without visually ambiguous glyphs.
create or replace function public.generate_short_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i integer;
begin
  if new.short_code is not null then
    return new;
  end if;

  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
    end loop;
    exit when not exists (select 1 from public.orders o where o.short_code = candidate);
  end loop;

  new.short_code := candidate;
  return new;
end;
$$;

create trigger orders_generate_short_code
  before insert on public.orders
  for each row execute function public.generate_short_code();

-- total = subtotal + delivery_fee + tip.
-- platform_fee is the store commission on the subtotal; it is deducted from
-- the merchant payout and therefore not added to the customer total.
create or replace function public.compute_order_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  store_commission numeric;
begin
  select s.commission_pct into store_commission
  from public.stores s
  where s.id = new.store_id;

  new.platform_fee := round(coalesce(new.subtotal, 0) * coalesce(store_commission, 0) / 100, 2);
  new.total := coalesce(new.subtotal, 0) + coalesce(new.delivery_fee, 0) + coalesce(new.tip, 0);
  return new;
end;
$$;

create trigger orders_compute_totals
  before insert or update on public.orders
  for each row execute function public.compute_order_totals();

-- Keep orders.subtotal in sync with the sum of its items. This only updates
-- the orders row (which recomputes totals in a BEFORE trigger); it never
-- writes back to order_items, so it cannot recurse.
create or replace function public.recalc_order_subtotal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_order uuid;
begin
  for target_order in
    select distinct unnest(array_remove(array[
      case when tg_op in ('INSERT', 'UPDATE') then new.order_id end,
      case when tg_op in ('UPDATE', 'DELETE') then old.order_id end
    ], null))
  loop
    update public.orders o
    set subtotal = coalesce((
      select sum(oi.line_total) from public.order_items oi where oi.order_id = target_order
    ), 0)
    where o.id = target_order;
  end loop;

  return null;
end;
$$;

create trigger order_items_recalc_subtotal
  after insert or update or delete on public.order_items
  for each row execute function public.recalc_order_subtotal();

-- Stamp the matching *_at column whenever the status changes.
create or replace function public.set_order_status_timestamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    case new.status
      when 'accepted' then new.accepted_at := now();
      when 'preparing' then new.preparing_at := now();
      when 'ready' then new.ready_at := now();
      when 'picked_up' then new.picked_up_at := now();
      when 'delivered' then new.delivered_at := now();
      when 'cancelled' then new.cancelled_at := now();
      else null;
    end case;
  end if;
  return new;
end;
$$;

create trigger orders_set_status_timestamp
  before update on public.orders
  for each row execute function public.set_order_status_timestamp();

-- ---------------------------------------------------------------------------
-- Reviews: keep the store rating aggregate up to date
-- ---------------------------------------------------------------------------
create or replace function public.update_store_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_store uuid;
begin
  for target_store in
    select distinct unnest(array_remove(array[
      case when tg_op in ('INSERT', 'UPDATE') then new.store_id end,
      case when tg_op in ('UPDATE', 'DELETE') then old.store_id end
    ], null))
  loop
    update public.stores s
    set rating_avg = coalesce((
          select round(avg(r.rating)::numeric, 2) from public.reviews r where r.store_id = target_store
        ), 0),
        rating_count = (
          select count(*) from public.reviews r where r.store_id = target_store
        )
    where s.id = target_store;
  end loop;

  return null;
end;
$$;

create trigger reviews_update_store_rating
  after insert or update or delete on public.reviews
  for each row execute function public.update_store_rating();

-- ---------------------------------------------------------------------------
-- Geo search: active stores within a radius, nearest first (Haversine)
-- ---------------------------------------------------------------------------
create or replace function public.stores_nearby(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision default 10
)
returns table (
  id uuid,
  owner_id uuid,
  slug text,
  name text,
  description text,
  category text,
  logo_url text,
  cover_url text,
  theme jsonb,
  address text,
  lat double precision,
  lng double precision,
  delivery_radius_km numeric,
  min_order numeric,
  delivery_fee numeric,
  prep_time_min integer,
  commission_pct numeric,
  is_open boolean,
  schedule jsonb,
  whatsapp_phone text,
  status public.store_status,
  rating_avg numeric,
  rating_count integer,
  created_at timestamptz,
  updated_at timestamptz,
  distance_km numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with measured as (
    select
      s.*,
      round((
        6371 * acos(
          least(1.0, greatest(-1.0,
            cos(radians(p_lat)) * cos(radians(s.lat)) * cos(radians(s.lng) - radians(p_lng))
            + sin(radians(p_lat)) * sin(radians(s.lat))
          ))
        )
      )::numeric, 2) as distance_km
    from public.stores s
    where s.status = 'active'
      and s.lat is not null
      and s.lng is not null
  )
  select
    m.id, m.owner_id, m.slug, m.name, m.description, m.category, m.logo_url, m.cover_url,
    m.theme, m.address, m.lat, m.lng, m.delivery_radius_km, m.min_order, m.delivery_fee,
    m.prep_time_min, m.commission_pct, m.is_open, m.schedule, m.whatsapp_phone, m.status,
    m.rating_avg, m.rating_count, m.created_at, m.updated_at, m.distance_km
  from measured m
  where m.distance_km <= p_radius_km
  order by m.distance_km asc, m.name asc;
$$;
