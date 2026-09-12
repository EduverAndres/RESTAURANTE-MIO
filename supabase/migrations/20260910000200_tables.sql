-- Core tables and indexes.

-- Profiles: one row per auth user, created by the handle_new_user trigger.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'customer',
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Stores: a merchant storefront. The theme column drives the public page look.
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  description text,
  category text,
  logo_url text,
  cover_url text,
  theme jsonb not null default '{
    "primary": "#C2410C",
    "accent": "#F59E0B",
    "background": "#FBF8F3",
    "surface": "#FFFFFF",
    "text": "#1C1917",
    "radius": 20,
    "fontDisplay": "Fraunces",
    "fontBody": "Inter",
    "banner": { "imageUrl": null, "overlayOpacity": 0.35, "layout": "full" },
    "logoUrl": null,
    "sectionOrder": ["hero", "featured", "menu", "info"],
    "buttonStyle": "pill"
  }'::jsonb,
  address text,
  lat double precision,
  lng double precision,
  delivery_radius_km numeric not null default 5,
  min_order numeric not null default 0,
  delivery_fee numeric not null default 0,
  prep_time_min integer not null default 20,
  commission_pct numeric not null default 6,
  is_open boolean not null default true,
  schedule jsonb not null default '{}'::jsonb,
  whatsapp_phone text,
  status public.store_status not null default 'pending',
  rating_avg numeric not null default 0,
  rating_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  position integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  category_id uuid references public.menu_categories (id) on delete set null,
  name text not null,
  description text,
  price numeric not null check (price >= 0),
  image_url text,
  is_available boolean not null default true,
  position integer not null default 0,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Option groups (size, extras, doneness...) attached to a product.
create table public.product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null,
  required boolean not null default false,
  min integer not null default 0,
  max integer not null default 1,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_option_values (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.product_options (id) on delete cascade,
  name text not null,
  price_delta numeric not null default 0,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text,
  line1 text not null,
  line2 text,
  lat double precision,
  lng double precision,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Orders. customer_id is nullable so anonymous table orders (QR flow) can exist.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  short_code text not null unique,
  store_id uuid not null references public.stores (id) on delete restrict,
  customer_id uuid references public.profiles (id) on delete set null,
  courier_id uuid references public.profiles (id) on delete set null,
  address_id uuid references public.addresses (id) on delete set null,
  type public.order_type not null default 'delivery',
  table_number integer,
  status public.order_status not null default 'pending',
  subtotal numeric not null default 0,
  delivery_fee numeric not null default 0,
  platform_fee numeric not null default 0,
  tip numeric not null default 0,
  total numeric not null default 0,
  payment_method public.payment_method not null default 'cash',
  payment_status public.payment_status not null default 'pending',
  payment_ref text,
  notes text,
  estimated_at timestamptz,
  accepted_at timestamptz,
  preparing_at timestamptz,
  ready_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name_snapshot text not null,
  unit_price numeric not null,
  quantity integer not null check (quantity > 0),
  options jsonb not null default '[]'::jsonb,
  line_total numeric generated always as (unit_price * quantity) stored,
  created_at timestamptz not null default now()
);

-- Latest known position per courier (upserted by the courier app).
create table public.courier_locations (
  courier_id uuid primary key references public.profiles (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  heading numeric,
  updated_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, store_id)
);

-- Physical tables with a QR token used for dine-in ordering.
create table public.store_tables (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  number integer not null,
  qr_token text not null unique default encode(extensions.gen_random_bytes(12), 'hex'),
  created_at timestamptz not null default now(),
  unique (store_id, number)
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  gross numeric not null default 0,
  commission numeric not null default 0,
  net numeric not null default 0,
  status public.payout_status not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index stores_slug_idx on public.stores (slug);
create index stores_status_idx on public.stores (status);
create index stores_lat_lng_idx on public.stores (lat, lng);
create index products_store_category_idx on public.products (store_id, category_id);
create index orders_store_status_idx on public.orders (store_id, status);
create index orders_customer_idx on public.orders (customer_id);
create index orders_courier_idx on public.orders (courier_id);
create index orders_short_code_idx on public.orders (short_code);
create index order_items_order_idx on public.order_items (order_id);
create index menu_categories_store_idx on public.menu_categories (store_id);
create index addresses_user_idx on public.addresses (user_id);
create index reviews_store_idx on public.reviews (store_id);
