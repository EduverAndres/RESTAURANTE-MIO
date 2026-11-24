-- Undoes 20261125000200_notifications_broadcast.sql: back to Postgres Changes.
set lock_timeout = '3s';

alter publication supabase_realtime add table public.notifications;

drop policy if exists "notifications: recipient receives own topic"
  on realtime.messages;

drop trigger if exists notifications_broadcast on public.notifications;

drop function if exists public.broadcast_notification();

reset lock_timeout;
