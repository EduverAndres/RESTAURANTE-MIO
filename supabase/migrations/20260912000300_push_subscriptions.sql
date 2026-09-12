-- Web push subscriptions. One row per browser/device endpoint; a user can
-- have several (phone, laptop, ...). Endpoints are globally unique so an
-- upsert on `endpoint` from the client keeps re-subscribing idempotent.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

create trigger push_subscriptions_set_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions: admin full access"
  on public.push_subscriptions for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- The owning user manages their own subscriptions; the send helper reads
-- across users with the service role, which bypasses RLS.
create policy "push_subscriptions: owner manage"
  on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
