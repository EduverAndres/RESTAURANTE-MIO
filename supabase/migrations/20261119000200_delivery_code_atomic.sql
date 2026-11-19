-- The handover code's attempt limit, enforced atomically.
--
-- The courier action used to read `attempts`, compare in JavaScript and write
-- the new count back. Concurrent requests all read the same count, so a
-- courier firing a few thousand guesses in parallel tried most of the 10,000
-- four-digit codes before the lock ever triggered. Here the row is locked
-- (`for update`) for the whole read-compare-count, so parallel attempts are
-- serialised and the limit holds exactly.
--
-- The decision mirrors `deliveryAttemptOutcome` in
-- lib/tracking/delivery-attempts.ts: a locked code stays locked, a match is
-- ok, a mismatch counts and locks at the limit (passed in from
-- MAX_DELIVERY_CODE_ATTEMPTS so there is one number).

set lock_timeout = '3s';

create or replace function public.try_delivery_code(
  p_order_id uuid,
  p_code text,
  p_max_attempts integer
)
returns table (outcome text, attempts integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.delivery_codes%rowtype;
  v_next integer;
begin
  select * into v_row
  from public.delivery_codes d
  where d.order_id = p_order_id
  for update;

  if not found then
    return query select 'none'::text, 0;
    return;
  end if;
  if v_row.locked_at is not null then
    return query select 'locked'::text, v_row.attempts;
    return;
  end if;
  if v_row.code = p_code then
    return query select 'ok'::text, v_row.attempts;
    return;
  end if;

  v_next := v_row.attempts + 1;
  update public.delivery_codes d
  set attempts = v_next,
      locked_at = case when v_next >= p_max_attempts then now() else null end
  where d.order_id = p_order_id;

  return query select
    (case when v_next >= p_max_attempts then 'locked' else 'mismatch' end)::text,
    v_next;
end;
$$;

comment on function public.try_delivery_code(uuid, text, integer) is
  'Atomically checks a handover code and counts a wrong attempt; locks at p_max_attempts. Server-only.';

-- Only the server (service role) checks codes; no browser role may call it.
revoke all on function public.try_delivery_code(uuid, text, integer) from public;
revoke all on function public.try_delivery_code(uuid, text, integer) from anon, authenticated;
grant execute on function public.try_delivery_code(uuid, text, integer) to service_role;
