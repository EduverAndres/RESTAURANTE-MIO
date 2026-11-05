-- Every store that exists when the plans arrive becomes a founder for 90 days.
--
-- Why: migration 20261105000100 changes what stores pay (0% on table orders,
-- +5% when the customer pays online) and puts every store on the Normal plan,
-- which drops custom CSS, the hero video and most of the theme editor. The
-- partner terms (terminos-aliados) require a rate change to be announced 30
-- days ahead. As founders, existing stores pay a 0% base commission (5% on
-- online payments, below the 6% they paid on everything before) and keep
-- every VIP feature, so nothing gets worse for them while they are told
-- about the new plans.
--
-- Stores created after this migration are not touched: an admin decides who
-- else is a founder from /admin/stores. To undo for one store:
--   update public.stores set founder_until = null where slug = '<slug>';

update public.stores
set founder_until = (now() at time zone 'America/Bogota')::date + 90
where founder_until is null;
