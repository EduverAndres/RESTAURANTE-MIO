-- The money side of corporate accounts. Service role only.
--
--   * `authorize_corporate_payment(order)`: the charge. Locks the order, then
--     the company, so two employees of one company are served one after the
--     other and the second sees the first's charge. Refuses, in this order
--     (the same as `authorizeCorporateCharge` in lib/companies/budget.ts): a
--     company that is not active, a company in arrears, a member who left,
--     the per-order cap, a tip over the company's maximum, the member's
--     monthly budget, the company's credit line. Otherwise the order becomes
--     `paid` with `payment_ref = 'corp_<short_code>'`, gets its billing
--     period, and the merchant's billing snapshot is written. Calling it
--     again for a paid order answers `ok` again and changes nothing.
--   * `generate_company_statements(period)`: bills a closed month, one
--     statement per company with something to bill (lib/companies/statement.ts).
--   * `refresh_overdue_company_statements()`: stamps statements past due.
--   * `void_company_statement(statement, reason)`: annuls an unpaid one; its
--     orders are free to be billed again.
--
-- Settlement is untouched: a corporate order marked paid is settled to the
-- merchant like an online payment, with the online-payment commission.
--
-- Additive and reversible:
-- supabase/rollbacks/20261124000800_corporate_charges.down.sql.

set lock_timeout = '3s';

-- ---------------------------------------------------------------------------
-- 1. Authorising a charge
-- ---------------------------------------------------------------------------
create or replace function public.authorize_corporate_payment(p_order_id uuid)
returns table (outcome text, payment_ref text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_company public.companies%rowtype;
  v_member public.company_members%rowtype;
  v_period date := public.bogota_month_start();
  v_ref text;
begin
  -- Order first, company second, always in this order: no deadlock between
  -- two charges, and a repeat call for the same order waits for the first.
  select * into v_order from public.orders o where o.id = p_order_id for update;
  if not found then
    return query select 'not_found'::text, null::text;
    return;
  end if;
  if v_order.payment_method <> 'corporate' or v_order.company_id is null then
    return query select 'not_corporate'::text, null::text;
    return;
  end if;

  v_ref := 'corp_' || v_order.short_code;

  -- Idempotent: already authorised, same answer, nothing written.
  if v_order.payment_status = 'paid' then
    return query select 'ok'::text, coalesce(v_order.payment_ref, v_ref);
    return;
  end if;
  if v_order.payment_status <> 'pending' or v_order.status = 'cancelled' then
    return query select 'not_pending'::text, null::text;
    return;
  end if;

  select * into v_company
  from public.companies c
  where c.id = v_order.company_id
  for update;

  if v_company.status <> 'active' then
    return query select 'company_inactive'::text, null::text;
    return;
  end if;

  if public.company_is_overdue(v_company.id) then
    return query select 'company_overdue'::text, null::text;
    return;
  end if;

  select * into v_member
  from public.company_members m
  where m.id = v_order.company_member_id;
  if not found
     or not v_member.active
     or v_member.company_id <> v_company.id
     or v_member.user_id is distinct from v_order.customer_id then
    return query select 'member_inactive'::text, null::text;
    return;
  end if;

  if v_member.per_order_limit is not null
     and v_order.total > v_member.per_order_limit then
    return query select 'over_order_limit'::text, null::text;
    return;
  end if;

  if
-- codegen:begin(tip_exceeds)
v_order.tip * 100 > v_company.max_tip_pct * v_order.subtotal
-- codegen:end(tip_exceeds)
  then
    return query select 'tip_too_high'::text, null::text;
    return;
  end if;

  -- This order is still `pending`, so neither sum below counts it yet.
  if v_member.monthly_budget is not null
     and public.company_member_spent(v_member.id, v_period) + v_order.total
       > v_member.monthly_budget then
    return query select 'over_member_budget'::text, null::text;
    return;
  end if;

  if public.company_credit_used(v_company.id) + v_order.total
     > v_company.credit_limit then
    return query select 'over_credit_limit'::text, null::text;
    return;
  end if;

  update public.orders
  set payment_status = 'paid',
      payment_ref = v_ref,
      corporate_period = v_period
  where id = p_order_id;

  insert into public.order_corporate_billing (
    order_id, company_id, store_id, legal_name, nit, dv,
    billing_email, billing_address, city
  )
  values (
    v_order.id, v_company.id, v_order.store_id, v_company.legal_name,
    v_company.nit, v_company.dv, v_company.billing_email,
    v_company.billing_address, v_company.city
  )
  on conflict (order_id) do nothing;

  return query select 'ok'::text, v_ref;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Monthly statements
-- ---------------------------------------------------------------------------
create or replace function public.generate_company_statements(p_period date)
returns table (
  statements_created integer,
  statements_skipped integer,
  lines_added integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  -- The period ends at the next month's midnight in Bogotá.
  v_end timestamptz := ((p_period + interval '1 month')::date::timestamp at time zone 'America/Bogota');
  v_today date := (now() at time zone 'America/Bogota')::date;
  v_company public.companies%rowtype;
  v_statement uuid;
  v_charges integer;
  v_credits integer;
  v_created integer := 0;
  v_skipped integer := 0;
  v_lines integer := 0;
begin
  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'the period must be the first day of a month'
      using errcode = 'invalid_parameter_value';
  end if;
  if p_period >= public.bogota_month_start() then
    raise exception 'period % has not closed yet', p_period
      using errcode = 'invalid_parameter_value';
  end if;

  -- One run at a time: two runs would race for the same orders.
  perform pg_advisory_xact_lock(hashtext('public.generate_company_statements'));

  for v_company in
    select * from public.companies c where c.status <> 'pending' order by c.id
  loop
    if exists (
      select 1 from public.company_statements s
      where s.company_id = v_company.id
        and s.period = p_period
        and s.status <> 'void'
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into public.company_statements (
      company_id, period, legal_name, nit, dv, issued_on, due_on, total
    )
    values (
      v_company.id, p_period, v_company.legal_name, v_company.nit,
      v_company.dv, v_today, v_today + v_company.payment_terms_days, 0
    )
    returning id into v_statement;

    -- Charges: delivered corporate orders of this period or an earlier one,
    -- delivered before it closed, not on a live statement yet.
    insert into public.company_statement_lines (
      statement_id, company_id, order_id, kind, amount, short_code,
      store_name, member_name, corporate_reference, ordered_at
    )
    select
      v_statement, v_company.id, o.id, 'charge', o.total, o.short_code,
      st.name, p.full_name, o.corporate_reference, o.created_at
    from public.orders o
    join public.stores st on st.id = o.store_id
    left join public.company_members m on m.id = o.company_member_id
    left join public.profiles p on p.id = m.user_id
    where o.company_id = v_company.id
      and
-- codegen:begin(billable_charge)
o.payment_method = 'corporate' and o.status = 'delivered' and o.payment_status in ('paid', 'refunded')
-- codegen:end(billable_charge)
      and o.corporate_period <= p_period
      and o.delivered_at < v_end
      and not exists (
        select 1 from public.company_statement_lines l
        where l.order_id = o.id and l.kind = 'charge' and not l.voided
      );
    get diagnostics v_charges = row_count;

    -- Credits (abonos): refunds recorded before the period closed, on orders
    -- already charged (including the charges just added), not credited yet.
    insert into public.company_statement_lines (
      statement_id, company_id, order_id, kind, amount, short_code,
      store_name, member_name, corporate_reference, ordered_at
    )
    select
      v_statement, v_company.id, o.id, 'refund', -r.amount, o.short_code,
      st.name, p.full_name, o.corporate_reference, o.created_at
    from public.refunds r
    join public.orders o on o.id = r.order_id
    join public.stores st on st.id = o.store_id
    left join public.company_members m on m.id = o.company_member_id
    left join public.profiles p on p.id = m.user_id
    where o.company_id = v_company.id
      and r.issued_at < v_end
      and exists (
        select 1 from public.company_statement_lines l
        where l.order_id = o.id and l.kind = 'charge' and not l.voided
      )
      and not exists (
        select 1 from public.company_statement_lines l
        where l.order_id = o.id and l.kind = 'refund' and not l.voided
      );
    get diagnostics v_credits = row_count;

    if v_charges + v_credits = 0 then
      delete from public.company_statements where id = v_statement;
      continue;
    end if;

    update public.company_statements
    set total = (
      select coalesce(sum(l.amount), 0)
      from public.company_statement_lines l
      where l.statement_id = v_statement
    )
    where id = v_statement;

    v_created := v_created + 1;
    v_lines := v_lines + v_charges + v_credits;
  end loop;

  return query select v_created, v_skipped, v_lines;
end;
$$;

-- Issued statements past due, with money to pay, become overdue. Mirror of
-- `statementDisplayStatus`. Authorisation does not wait for this: it reads
-- the due date itself (`company_is_overdue`).
create or replace function public.refresh_overdue_company_statements()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'America/Bogota')::date;
  v_count integer;
begin
  update public.company_statements s
  set status = 'overdue'
  where
-- codegen:begin(statement_becomes_overdue)
s.status = 'issued' and s.total > 0 and s.due_on < v_today
-- codegen:end(statement_becomes_overdue)
  ;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Annuls an unpaid statement. Its lines stay, marked voided, so the record
-- of what was sent survives and the orders can be billed again.
create or replace function public.void_company_statement(p_statement_id uuid, p_reason text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.company_statements
  set status = 'void',
      voided_at = now(),
      void_reason = p_reason
  where id = p_statement_id
    and status in (
-- codegen:begin(open_statements_void)
'issued', 'overdue'
-- codegen:end(open_statements_void)
    );
  if not found then
    return 'not_open';
  end if;

  update public.company_statement_lines
  set voided = true
  where statement_id = p_statement_id;
  return 'ok';
exception
  when check_violation then
    return 'invalid';
end;
$$;

revoke all on function public.authorize_corporate_payment(uuid) from public, anon, authenticated;
grant execute on function public.authorize_corporate_payment(uuid) to service_role;
revoke all on function public.generate_company_statements(date) from public, anon, authenticated;
grant execute on function public.generate_company_statements(date) to service_role;
revoke all on function public.refresh_overdue_company_statements() from public, anon, authenticated;
grant execute on function public.refresh_overdue_company_statements() to service_role;
revoke all on function public.void_company_statement(uuid, text) from public, anon, authenticated;
grant execute on function public.void_company_statement(uuid, text) to service_role;

reset lock_timeout;
