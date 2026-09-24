-- Three-party delivery confirmation.
--
-- A delivery order is marked delivered by one of three parties and the order
-- records which one:
--
--   * 'code'     -- the courier typed the four-digit handover code the
--                  customer read out at the door (the normal path);
--   * 'customer' -- the customer pressed "Ya lo recibí" on their own order;
--   * 'merchant' -- the store owner closed the order from the dashboard.
--
-- The code lives in its own table, NOT on orders: couriers `select *` their
-- assigned orders under RLS, so a column on orders would hand them the
-- secret. Only the customer (select) and admins (all) get a policy here; the
-- service role writes and compares it from server actions. It is never added
-- to the realtime publication either, for the same reason.
--
-- The trigger below is what makes the code enforceable rather than a UI
-- courtesy: a courier-role update that flips a delivery order to delivered is
-- refused at the database, even through PostgREST directly. Owners, admins
-- and the service role (auth.uid() is null) are unaffected, so the confirmed
-- paths above keep working.

set lock_timeout = '3s';

-- ---------------------------------------------------------------------------
-- delivery_codes
-- ---------------------------------------------------------------------------
create table public.delivery_codes (
  order_id uuid primary key references public.orders (id) on delete cascade,
  code text not null check (code ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now()
);

comment on table public.delivery_codes is
  'Four-digit handover code per delivery order. Readable by the customer only; written and compared server-side.';

alter table public.delivery_codes enable row level security;

create policy "delivery_codes: admin full access"
  on public.delivery_codes for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- The subquery runs under the caller's orders policies; a customer only ever
-- sees their own order, so this resolves to exactly their own code.
create policy "delivery_codes: customer read own"
  on public.delivery_codes for select to authenticated
  using (
    exists (
      select 1
      from public.orders o
      where o.id = delivery_codes.order_id
        and o.customer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- orders: who confirmed the delivery, and when
-- ---------------------------------------------------------------------------
alter table public.orders
  add column delivery_confirmed_by text
    check (delivery_confirmed_by in ('code', 'customer', 'merchant')),
  add column delivery_confirmed_at timestamptz;

comment on column public.orders.delivery_confirmed_by is
  'Which party confirmed the handover: code (courier typed the customer code), customer (self-confirmed), merchant (closed from the dashboard).';
comment on column public.orders.delivery_confirmed_at is
  'When the handover was confirmed; null until delivered.';

-- ---------------------------------------------------------------------------
-- courier_locations: GPS accuracy of the last fix
-- ---------------------------------------------------------------------------
alter table public.courier_locations
  add column accuracy_m numeric;

comment on column public.courier_locations.accuracy_m is
  'Reported GPS accuracy of the fix in metres; null when the device did not say.';

-- ---------------------------------------------------------------------------
-- Refuse a courier-role update that marks a delivery order delivered
-- ---------------------------------------------------------------------------
create or replace function public.require_delivery_confirmation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'delivered'
    and old.status is distinct from 'delivered'
    and old.type = 'delivery'
    and auth.uid() is not null
    and public.user_role_of(auth.uid()) = 'courier'
  then
    raise exception 'delivery must be confirmed with the customer code'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

-- Supabase's default privileges grant EXECUTE on every new public function to
-- the browser roles (see 20260919000600). Nothing calls this except the
-- trigger, which fires regardless of the caller's EXECUTE grant.
revoke all on function public.require_delivery_confirmation()
  from public, anon, authenticated;

create trigger orders_require_delivery_confirmation
  before update on public.orders
  for each row execute function public.require_delivery_confirmation();

reset lock_timeout;
