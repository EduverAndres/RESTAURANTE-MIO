-- Stop exposing table QR tokens.
--
-- The original "store_tables: public read" policy let anyone list every
-- qr_token of every store through the REST endpoint, which defeats the point
-- of a secret token. The public QR flow only ever needs to resolve one token
-- for one store, so that lookup now goes through a security definer function
-- and the public SELECT policy is dropped. Owner and admin policies
-- ("store_tables: owner manage", "store_tables: admin full access") are kept.

drop policy if exists "store_tables: public read" on public.store_tables;

-- Resolves a table from the store slug in the URL and the scanned token.
-- Returns no row for inactive stores or unknown tokens.
create or replace function public.resolve_store_table(store_slug text, token text)
returns table (id uuid, store_id uuid, number integer)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.store_id, t.number
  from public.store_tables t
  join public.stores s on s.id = t.store_id
  where s.slug = store_slug
    and s.status = 'active'
    and t.qr_token = token;
$$;

revoke all on function public.resolve_store_table(text, text) from public;
grant execute on function public.resolve_store_table(text, text) to anon, authenticated;
