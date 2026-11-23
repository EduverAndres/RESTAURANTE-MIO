-- A new way to pay: the company's account ("Cuenta de empresa").
--
-- On its own on purpose. Postgres refuses to USE an enum value in the same
-- transaction that added it ("unsafe use of new value"), and the next
-- migration needs it in a check constraint. Each migration file is applied in
-- its own transaction, so splitting the ADD VALUE out is what lets 0600 say
-- `payment_method = 'corporate'`.
--
-- What it means for money, unchanged elsewhere: a corporate order is created
-- `pending` and `authorize_corporate_payment` (0800) marks it `paid` when the
-- charge fits the company's credit. From there it is settled exactly like an
-- online payment: the merchant's payout counts it, the commission adds the
-- online-payment percentage (`payment_method <> 'cash'`), and a courier who
-- delivers it earns without collecting cash.
--
-- Not reversible: Postgres has no `drop value`. See
-- supabase/rollbacks/20261124000500_payment_method_corporate.down.sql.

alter type public.payment_method add value if not exists 'corporate';
