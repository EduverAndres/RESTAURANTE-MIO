-- Notifications delivered by Realtime Broadcast instead of Postgres Changes.
--
-- 20261125000100 published `notifications` for Postgres Changes. That path
-- is the slow one: the Realtime server decodes the WAL on a single thread,
-- then runs an RLS query per subscriber for every row before it sends
-- anything, so on a busy hosted project a notification can take seconds to
-- arrive. Broadcast from the database skips both steps: a trigger hands the
-- row to `realtime.send()` when the insert commits, on a private topic per
-- person (`user:<id>`), and Realtime pushes it straight to that socket.
--
-- Who may listen is decided once, when the channel joins, by the policy on
-- `realtime.messages` below: a signed-in user can join only their own topic.
-- The payload is the notification row itself, already addressed to them.
--
-- The table leaves the Postgres Changes publication: nothing subscribes to
-- it that way any more, and keeping it would make Realtime decode and check
-- every insert for nobody.
--
-- supabase/rollbacks/20261125000200_notifications_broadcast.down.sql undoes it.

set lock_timeout = '3s';

create function public.broadcast_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'id', new.id,
      'kind', new.kind,
      'title', new.title,
      'body', new.body,
      'url', new.url,
      'read_at', new.read_at,
      'created_at', new.created_at
    ),
    'notification',
    'user:' || new.recipient_id::text,
    true
  );
  return null;
end;
$$;

comment on function public.broadcast_notification() is
  'Trigger: sends each new notification to its recipient''s private Realtime topic (user:<id>).';

revoke all on function public.broadcast_notification() from public, anon, authenticated;

create trigger notifications_broadcast
  after insert on public.notifications
  for each row execute function public.broadcast_notification();

-- Realtime Authorization: a signed-in user receives broadcasts on their own
-- topic and nobody else's.
create policy "notifications: recipient receives own topic"
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() = 'user:' || (select auth.uid())::text
  );

alter publication supabase_realtime drop table public.notifications;

reset lock_timeout;
