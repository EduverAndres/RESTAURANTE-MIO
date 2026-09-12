-- Row level security. Every table is locked down; policies grant the minimum
-- each actor needs. Helper functions (is_admin, owns_store, ...) are security
-- definer so policies never depend on the caller being able to read the
-- tables they check.

-- ---------------------------------------------------------------------------
-- Grants (mirror the Supabase defaults; RLS does the real gating)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.menu_categories enable row level security;
alter table public.products enable row level security;
alter table public.product_options enable row level security;
alter table public.product_option_values enable row level security;
alter table public.addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.courier_locations enable row level security;
alter table public.reviews enable row level security;
alter table public.favorites enable row level security;
alter table public.store_tables enable row level security;
alter table public.payouts enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "profiles: admin full access"
  on public.profiles for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- A user sees their own row; merchants see the customers and couriers of
-- their store orders; couriers see the customers of orders assigned to them.
create policy "profiles: read own or related"
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.orders o
      where public.owns_store(o.store_id)
        and (o.customer_id = profiles.id or o.courier_id = profiles.id)
    )
    or exists (
      select 1
      from public.orders o
      where o.courier_id = auth.uid()
        and o.customer_id = profiles.id
    )
  );

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- stores
-- ---------------------------------------------------------------------------
create policy "stores: admin full access"
  on public.stores for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Active stores are public; owners always see their own.
create policy "stores: public read active or own"
  on public.stores for select to anon, authenticated
  using (status = 'active' or owner_id = auth.uid());

create policy "stores: owner insert"
  on public.stores for insert to authenticated
  with check (owner_id = auth.uid());

-- commission_pct and status are guarded by the protect_store_admin_columns trigger.
create policy "stores: owner update"
  on public.stores for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- menu_categories
-- ---------------------------------------------------------------------------
create policy "menu_categories: admin full access"
  on public.menu_categories for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "menu_categories: public read when store visible"
  on public.menu_categories for select to anon, authenticated
  using (public.store_is_visible(store_id));

create policy "menu_categories: owner manage"
  on public.menu_categories for all to authenticated
  using (public.owns_store(store_id))
  with check (public.owns_store(store_id));

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create policy "products: admin full access"
  on public.products for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "products: public read when store visible"
  on public.products for select to anon, authenticated
  using (public.store_is_visible(store_id));

create policy "products: owner manage"
  on public.products for all to authenticated
  using (public.owns_store(store_id))
  with check (public.owns_store(store_id));

-- ---------------------------------------------------------------------------
-- product_options
-- ---------------------------------------------------------------------------
create policy "product_options: admin full access"
  on public.product_options for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "product_options: public read when store visible"
  on public.product_options for select to anon, authenticated
  using (public.store_is_visible(public.product_store_id(product_id)));

create policy "product_options: owner manage"
  on public.product_options for all to authenticated
  using (public.owns_store(public.product_store_id(product_id)))
  with check (public.owns_store(public.product_store_id(product_id)));

-- ---------------------------------------------------------------------------
-- product_option_values
-- ---------------------------------------------------------------------------
create policy "product_option_values: admin full access"
  on public.product_option_values for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "product_option_values: public read when store visible"
  on public.product_option_values for select to anon, authenticated
  using (public.store_is_visible(public.option_store_id(option_id)));

create policy "product_option_values: owner manage"
  on public.product_option_values for all to authenticated
  using (public.owns_store(public.option_store_id(option_id)))
  with check (public.owns_store(public.option_store_id(option_id)));

-- ---------------------------------------------------------------------------
-- addresses (owner only)
-- ---------------------------------------------------------------------------
create policy "addresses: owner manage"
  on public.addresses for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
create policy "orders: admin full access"
  on public.orders for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Customers see their orders, owners see their store orders, couriers see
-- their assigned orders plus unclaimed delivery orders that are ready.
create policy "orders: read as customer, owner or courier"
  on public.orders for select to authenticated
  using (
    customer_id = auth.uid()
    or public.owns_store(store_id)
    or courier_id = auth.uid()
    or (
      courier_id is null
      and status = 'ready'
      and type = 'delivery'
      and public.user_role_of(auth.uid()) = 'courier'
    )
  );

-- New orders always start pending and unassigned.
create policy "orders: customer insert own"
  on public.orders for insert to authenticated
  with check (
    customer_id = auth.uid()
    and status = 'pending'
    and courier_id is null
  );

-- Anonymous dine-in orders created from a table QR code.
create policy "orders: anon insert table order"
  on public.orders for insert to anon
  with check (
    type = 'table'
    and customer_id is null
    and courier_id is null
    and status = 'pending'
  );

-- A customer may only cancel an order that is still pending.
create policy "orders: customer cancel pending"
  on public.orders for update to authenticated
  using (customer_id = auth.uid() and status = 'pending')
  with check (customer_id = auth.uid() and status = 'cancelled');

create policy "orders: owner update"
  on public.orders for update to authenticated
  using (public.owns_store(store_id))
  with check (public.owns_store(store_id));

-- Couriers claim ready delivery orders and advance the ones assigned to them.
create policy "orders: courier claim or advance"
  on public.orders for update to authenticated
  using (
    courier_id = auth.uid()
    or (
      courier_id is null
      and status = 'ready'
      and type = 'delivery'
      and public.user_role_of(auth.uid()) = 'courier'
    )
  )
  with check (courier_id = auth.uid());

-- ---------------------------------------------------------------------------
-- order_items (visibility follows the parent order)
-- ---------------------------------------------------------------------------
create policy "order_items: admin full access"
  on public.order_items for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- The subquery runs under the caller's orders policies, so items are visible
-- exactly when the parent order is.
create policy "order_items: read when order visible"
  on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_items.order_id));

create policy "order_items: insert into editable order"
  on public.order_items for insert to anon, authenticated
  with check (public.can_edit_order_items(order_id));

create policy "order_items: update in editable order"
  on public.order_items for update to authenticated
  using (public.can_edit_order_items(order_id))
  with check (public.can_edit_order_items(order_id));

create policy "order_items: delete from editable order"
  on public.order_items for delete to authenticated
  using (public.can_edit_order_items(order_id));

-- ---------------------------------------------------------------------------
-- courier_locations
-- ---------------------------------------------------------------------------
create policy "courier_locations: admin full access"
  on public.courier_locations for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "courier_locations: courier manage own"
  on public.courier_locations for all to authenticated
  using (courier_id = auth.uid())
  with check (courier_id = auth.uid());

-- Store owners and customers can follow the courier of an active order.
create policy "courier_locations: read for active order"
  on public.courier_locations for select to authenticated
  using (
    exists (
      select 1
      from public.orders o
      where o.courier_id = courier_locations.courier_id
        and o.status not in ('delivered', 'cancelled')
        and (o.customer_id = auth.uid() or public.owns_store(o.store_id))
    )
  );

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
create policy "reviews: admin full access"
  on public.reviews for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "reviews: public read"
  on public.reviews for select to anon, authenticated
  using (true);

-- Only the customer of a delivered order may review it.
create policy "reviews: customer insert for delivered order"
  on public.reviews for insert to authenticated
  with check (
    customer_id = auth.uid()
    and exists (
      select 1
      from public.orders o
      where o.id = reviews.order_id
        and o.customer_id = auth.uid()
        and o.store_id = reviews.store_id
        and o.status = 'delivered'
    )
  );

-- ---------------------------------------------------------------------------
-- favorites (owner only)
-- ---------------------------------------------------------------------------
create policy "favorites: owner manage"
  on public.favorites for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- store_tables (tokens are random, so public read is acceptable)
-- ---------------------------------------------------------------------------
create policy "store_tables: admin full access"
  on public.store_tables for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "store_tables: public read"
  on public.store_tables for select to anon, authenticated
  using (true);

create policy "store_tables: owner manage"
  on public.store_tables for all to authenticated
  using (public.owns_store(store_id))
  with check (public.owns_store(store_id));

-- ---------------------------------------------------------------------------
-- payouts
-- ---------------------------------------------------------------------------
create policy "payouts: admin full access"
  on public.payouts for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "payouts: owner read"
  on public.payouts for select to authenticated
  using (public.owns_store(store_id));

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.orders, public.order_items, public.courier_locations;
