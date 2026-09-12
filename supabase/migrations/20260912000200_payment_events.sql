-- Wompi (and future gateways) webhook events, kept for idempotency and audit.
--
-- Every inbound "transaction.updated" notification is stored here before its
-- outcome is applied to the order. The unique constraint on
-- (provider, event_id, status) makes replayed webhooks (Wompi retries up to
-- 3 times over 24h) a no-op: the insert hits a conflict and the handler
-- returns early without touching the order twice.

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  reference text not null,
  status text not null,
  amount_in_cents bigint,
  order_id uuid references public.orders (id) on delete set null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  unique (provider, event_id, status)
);

create index payment_events_order_id_idx on public.payment_events (order_id);

alter table public.payment_events enable row level security;

-- Only admins (and the service role, which bypasses RLS) can read events;
-- the webhook route writes with the service role.
create policy "payment_events: admin full access"
  on public.payment_events for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
