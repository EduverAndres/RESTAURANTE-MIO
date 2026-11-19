-- Reverts supabase/migrations/20261120000100_product_reviews.sql.
--
-- Not picked up by `supabase db push` (this folder is not a migrations
-- folder). Run by hand against a database only when the migration has to be
-- undone, then delete the migration's row from
-- supabase_migrations.schema_migrations so a later push can re-apply it:
--
--   psql "$SUPABASE_DB_URL" -f supabase/rollbacks/20261120000100_product_reviews.down.sql
--   psql "$SUPABASE_DB_URL" -c "delete from supabase_migrations.schema_migrations where version = '20261120000100'"
--
-- Dish reviews are deleted with the table: export them first if they matter.

set lock_timeout = '3s';

drop function if exists public.submit_order_reviews(uuid, integer, text, jsonb);

drop trigger if exists products_protect_rating on public.products;
drop function if exists public.protect_product_rating();

drop table if exists public.product_reviews;
drop function if exists public.update_product_rating();
drop function if exists public.set_product_review_author();

alter table public.products
  drop column if exists rating_count,
  drop column if exists rating_avg;
