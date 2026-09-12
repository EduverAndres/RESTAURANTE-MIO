-- Storage buckets for store branding and product images.
-- Objects are namespaced by store id: <store_id>/<file>. Only the owner of
-- that store (or an admin) may write inside the folder; reads are public.

insert into storage.buckets (id, name, public)
values
  ('store-assets', 'store-assets', true),
  ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- True when the first path folder is a uuid of a store the current user owns.
-- The regex guard prevents an invalid cast when the folder is not a uuid.
create or replace function public.owns_store_folder(folder text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select folder ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (public.owns_store(folder::uuid) or public.is_admin());
$$;

create policy "storage: public read tienda buckets"
  on storage.objects for select to anon, authenticated
  using (bucket_id in ('store-assets', 'product-images'));

create policy "storage: merchant insert into own store folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('store-assets', 'product-images')
    and public.owns_store_folder((storage.foldername(name))[1])
  );

create policy "storage: merchant update own store folder"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('store-assets', 'product-images')
    and public.owns_store_folder((storage.foldername(name))[1])
  )
  with check (
    bucket_id in ('store-assets', 'product-images')
    and public.owns_store_folder((storage.foldername(name))[1])
  );

create policy "storage: merchant delete from own store folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('store-assets', 'product-images')
    and public.owns_store_folder((storage.foldername(name))[1])
  );
