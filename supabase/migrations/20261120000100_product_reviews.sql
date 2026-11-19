-- Dish reviews: a rating (and an optional short comment) per item of a
-- delivered order, alongside the existing one-per-order store review.
--
-- Additive and reversible: a new table, two defaulted columns on products,
-- functions and triggers. supabase/rollbacks/20261120000100_product_reviews.down.sql
-- undoes it.
--
-- Privacy (Ley 1581): the public sees a reviewer's first name only. The first
-- name is copied by the database from the profile at write time (never sent
-- by the client), and column privileges keep `customer_id` and `order_id`
-- unreadable to the API roles altogether.
--
-- Moderation: the admin hides, never deletes. Hidden reviews are not shown
-- and do not count; the product's average and count are recomputed whenever
-- a review is added, hidden or shown again.

set lock_timeout = '3s';

-- ---------------------------------------------------------------------------
-- 1. Aggregates on products (read with the menu, no extra query)
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists rating_avg numeric(3, 2) not null default 0,
  add column if not exists rating_count integer not null default 0;

comment on column public.products.rating_avg is
  'Average of visible dish reviews (0 when none). Maintained by update_product_rating.';
comment on column public.products.rating_count is
  'Number of visible dish reviews. Maintained by update_product_rating.';

-- ---------------------------------------------------------------------------
-- 2. The reviews
-- ---------------------------------------------------------------------------
create table public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null unique references public.order_items (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  store_id uuid not null references public.stores (id) on delete cascade,
  customer_id uuid references public.profiles (id) on delete set null,
  author_first_name text
    check (author_first_name is null or char_length(author_first_name) <= 40),
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 300),
  hidden_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.product_reviews is
  'One rating per order item of a delivered order. Public: first name, rating, comment, date. Hidden by admins, never deleted.';

-- Newest visible reviews of a dish: the drawer's only query.
create index product_reviews_product_visible_idx
  on public.product_reviews (product_id, created_at desc)
  where hidden_at is null;
create index product_reviews_order_idx on public.product_reviews (order_id);
create index product_reviews_store_idx on public.product_reviews (store_id, created_at desc);

alter table public.product_reviews enable row level security;

-- Anyone may read visible reviews; admins read everything.
create policy "product_reviews: public read visible"
  on public.product_reviews for select to anon, authenticated
  using (hidden_at is null);

create policy "product_reviews: admin full access"
  on public.product_reviews for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No insert/update/delete policy for customers: they write only through
-- submit_order_reviews below, which checks the order.

-- Column privileges: the API roles can only ever select the public columns.
revoke all on public.product_reviews from anon, authenticated;
grant select (id, product_id, store_id, author_first_name, rating, comment, created_at)
  on public.product_reviews to anon, authenticated;
-- Admins moderate through the server (service role), which keeps full access.

-- ---------------------------------------------------------------------------
-- 3. First name only, set by the database
-- ---------------------------------------------------------------------------
create or replace function public.set_product_review_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
begin
  select p.full_name into v_full_name
  from public.profiles p
  where p.id = new.customer_id;

  new.author_first_name := nullif(
    left(split_part(btrim(coalesce(v_full_name, '')), ' ', 1), 40),
    ''
  );
  return new;
end;
$$;

create trigger product_reviews_set_author
  before insert on public.product_reviews
  for each row execute function public.set_product_review_author();

-- ---------------------------------------------------------------------------
-- 4. Aggregates follow inserts, hide/show and rating changes
-- ---------------------------------------------------------------------------
create or replace function public.update_product_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  for target in
    select distinct unnest(array_remove(array[
      case when tg_op in ('INSERT', 'UPDATE') then new.product_id end,
      case when tg_op in ('UPDATE', 'DELETE') then old.product_id end
    ], null))
  loop
    update public.products p
    set rating_avg = coalesce((
          select round(avg(r.rating)::numeric, 2)
          from public.product_reviews r
          where r.product_id = target and r.hidden_at is null
        ), 0),
        rating_count = (
          select count(*)
          from public.product_reviews r
          where r.product_id = target and r.hidden_at is null
        )
    where p.id = target;
  end loop;
  return null;
end;
$$;

create trigger product_reviews_update_rating
  after insert or delete or update of hidden_at, rating, product_id
  on public.product_reviews
  for each row execute function public.update_product_rating();

-- A merchant manages its products, but not their rating: same rule as the
-- store rating (stores_protect_rating). SECURITY INVOKER so `current_user`
-- is the API role for direct calls and the owner inside the trigger above.
create or replace function public.protect_product_rating()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.rating_avg <> 0 or new.rating_count <> 0 then
      raise exception 'Ratings come from reviews'
        using errcode = 'insufficient_privilege';
    end if;
  elsif new.rating_avg is distinct from old.rating_avg
     or new.rating_count is distinct from old.rating_count then
    raise exception 'Ratings come from reviews'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger products_protect_rating
  before insert or update on public.products
  for each row execute function public.protect_product_rating();

-- ---------------------------------------------------------------------------
-- 5. Submitting: the store review and the dish reviews, in one transaction
-- ---------------------------------------------------------------------------
-- p_items: [{ "order_item_id": uuid, "rating": 1..5, "comment": text|null }]
-- Items are optional; the store rating is required (as before).
create or replace function public.submit_order_reviews(
  p_order_id uuid,
  p_rating integer,
  p_comment text,
  p_items jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders%rowtype;
  v_item jsonb;
  v_line public.order_items%rowtype;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;

  select * into v_order
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found or v_order.customer_id is distinct from v_uid then
    raise exception 'Order not found' using errcode = 'insufficient_privilege';
  end if;
  if v_order.status <> 'delivered' then
    raise exception 'Only delivered orders can be reviewed'
      using errcode = 'insufficient_privilege';
  end if;

  -- The store review (unique per order: a second submit fails with 23505).
  insert into public.reviews (order_id, store_id, customer_id, rating, comment)
  values (v_order.id, v_order.store_id, v_uid, p_rating, nullif(btrim(p_comment), ''));

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    select * into v_line
    from public.order_items i
    where i.id = (v_item ->> 'order_item_id')::uuid
      and i.order_id = v_order.id;
    if not found then
      raise exception 'Item does not belong to the order'
        using errcode = 'insufficient_privilege';
    end if;

    insert into public.product_reviews (
      order_item_id, order_id, product_id, store_id, customer_id, rating, comment
    )
    values (
      v_line.id,
      v_order.id,
      v_line.product_id,
      v_order.store_id,
      v_uid,
      (v_item ->> 'rating')::smallint,
      nullif(btrim(v_item ->> 'comment'), '')
    );
  end loop;
end;
$$;

revoke all on function public.submit_order_reviews(uuid, integer, text, jsonb) from public, anon;
grant execute on function public.submit_order_reviews(uuid, integer, text, jsonb) to authenticated;

revoke all on function public.set_product_review_author() from public, anon, authenticated;
revoke all on function public.update_product_rating() from public, anon, authenticated;
