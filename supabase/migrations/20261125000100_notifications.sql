-- In-app notifications: a durable inbox per user, delivered live.
--
-- Until now an important event reached people only as a web push, if they
-- had enabled it, and admins got nothing at all: a store asking for a
-- sponsored campaign, a company signing up or a courier sending their papers
-- waited until someone happened to open the right admin page. Each such
-- event now writes one row per recipient here (server side, from
-- lib/notifications/send.ts, which also sends the push). The app's bell
-- listens to this table through Supabase Realtime, so the row reaches an
-- open screen in under a second, rings, and refreshes that screen, which is
-- also what makes a status change (a campaign approved, an account approved)
-- show up without a reload.
--
-- Privacy (Ley 1581): a notification is addressed to one person and only
-- that person can read it. Its text names the event, never another user's
-- contact data. Rows go with the account (on delete cascade).
--
-- Additive and reversible: one table and a realtime publication entry.
-- supabase/rollbacks/20261125000100_notifications.down.sql undoes it.

set lock_timeout = '3s';

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null
    constraint notifications_kind_check check (kind in (
-- codegen:begin(notification_kinds)
'ad_requested', 'company_registered', 'courier_submitted', 'store_registered', 'ad_reviewed', 'store_reviewed', 'payout', 'reservation_new', 'reservation_cancelled', 'courier_reviewed', 'courier_payout', 'company_reviewed', 'company_member_joined', 'company_statement', 'reservation_updated'
-- codegen:end(notification_kinds)
    )),
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 400),
  -- An in-app path: "/x", never "//host" (a protocol-relative link that
  -- would take the bell's click off the site).
  url text not null
    check (url ~ '^/([^/]|$)' and char_length(url) <= 300),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- The bell reads the newest first, and counts the unread.
create index notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);

create index notifications_unread_idx
  on public.notifications (recipient_id)
  where read_at is null;

comment on table public.notifications is
  'Per-user inbox written by the server (lib/notifications/send.ts) and delivered live to the bell through Realtime.';

alter table public.notifications enable row level security;

create policy "notifications: recipient reads own"
  on public.notifications for select to authenticated
  using (recipient_id = auth.uid());

create policy "notifications: recipient marks read"
  on public.notifications for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- Nobody writes through the API except to mark a row read: the column grant
-- leaves `read_at` as the only thing an owner can change.
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

alter publication supabase_realtime add table public.notifications;

reset lock_timeout;
