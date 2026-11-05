-- The current slug of the store a table QR token belongs to.
--
-- A printed QR encodes `/t/<slug>/mesa/<token>`, and `resolve_store_table`
-- only answers for that exact slug. Renaming a store's link therefore turned
-- every code glued to its tables into «Este código QR ya no es válido». The
-- table pages now ask this function for the store's current slug when the
-- pair does not match, and redirect there.
--
-- Same exposure rules as `resolve_store_table`: security definer because
-- store_tables has no public SELECT policy (tokens must not be listable), it
-- answers only for one exact token (96 random bits, unique) of an active
-- store, and what it returns, a store slug, is public anyway.

create or replace function public.table_token_store_slug(token text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select s.slug
  from public.store_tables t
  join public.stores s on s.id = t.store_id
  where t.qr_token = token
    and s.status = 'active';
$$;

revoke all on function public.table_token_store_slug(text) from public;
grant execute on function public.table_token_store_slug(text) to anon, authenticated;
