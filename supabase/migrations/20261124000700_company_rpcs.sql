-- What a signed-in user can do with a company account, as functions.
--
-- Every function here is SECURITY DEFINER, reads the caller from
-- `auth.uid()` and decides on its own whether the caller may act: company
-- admins manage their company, members read their own budget, anyone signed
-- in may register a company or accept an invitation they hold. The tables of
-- 20261124000600 have no write policies, so these are the only paths from a
-- session to them. They answer an `outcome` instead of raising, so the server
-- actions can map each case to a message.
--
-- Money is not here: authorising a charge and billing a month are
-- service-role functions (20261124000800).
--
-- Additive and reversible:
-- supabase/rollbacks/20261124000700_company_rpcs.down.sql.

set lock_timeout = '3s';

-- ---------------------------------------------------------------------------
-- 1. Signing a company up
-- ---------------------------------------------------------------------------
-- The caller becomes its first admin. Pending until the Cerquita team
-- approves it with a credit line, so nothing can be charged before that.
create or replace function public.register_company(
  p_legal_name text,
  p_trade_name text,
  p_nit text,
  p_dv integer,
  p_billing_email text,
  p_billing_address text,
  p_city text,
  p_contact_name text,
  p_contact_phone text,
  p_terms_version text
)
returns table (outcome text, company_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_constraint text;
begin
  if v_uid is null then
    return query select 'forbidden'::text, null::uuid;
    return;
  end if;

  if exists (
    select 1 from public.company_members m where m.user_id = v_uid and m.active
  ) then
    return query select 'already_member'::text, null::uuid;
    return;
  end if;

  if p_nit is null or p_nit !~ '^[0-9]{6,15}$'
     or public.nit_check_digit(p_nit) is distinct from p_dv then
    return query select 'nit_invalid'::text, null::uuid;
    return;
  end if;

  if exists (select 1 from public.companies c where c.nit = p_nit) then
    return query select 'nit_taken'::text, null::uuid;
    return;
  end if;

  insert into public.companies (
    legal_name, trade_name, nit, dv, billing_email, billing_address, city,
    contact_name, contact_phone, terms_version, terms_accepted_by, created_by
  )
  values (
    p_legal_name, nullif(btrim(p_trade_name), ''), p_nit, p_dv,
    lower(p_billing_email), p_billing_address, p_city,
    p_contact_name, p_contact_phone, p_terms_version, v_uid, v_uid
  )
  returning id into v_id;

  insert into public.company_members (company_id, user_id, role)
  values (v_id, v_uid, 'admin');

  return query select 'ok'::text, v_id;
exception
  when unique_violation then
    -- Two sign-ups racing: the same NIT, or the same person twice.
    get stacked diagnostics v_constraint = constraint_name;
    return query select
      (case when v_constraint = 'companies_nit_key' then 'nit_taken' else 'already_member' end)::text,
      null::uuid;
  when check_violation then
    return query select 'invalid'::text, null::uuid;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Invitations
-- ---------------------------------------------------------------------------
-- What a link offers, before accepting it. Only someone holding the token
-- can ask, and the answer names the company and the budget, nothing else.
create or replace function public.peek_company_invitation(p_token text)
returns table (
  outcome text,
  company_name text,
  role text,
  monthly_budget numeric,
  per_order_limit numeric,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_inv public.company_invitations%rowtype;
  v_company public.companies%rowtype;
  v_outcome text;
begin
  if auth.uid() is null or p_token is null then
    return query select 'not_found'::text, null::text, null::text, null::numeric, null::numeric, null::timestamptz;
    return;
  end if;

  select * into v_inv
  from public.company_invitations i
  where i.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  if not found then
    return query select 'not_found'::text, null::text, null::text, null::numeric, null::numeric, null::timestamptz;
    return;
  end if;

  select * into v_company from public.companies c where c.id = v_inv.company_id;

  v_outcome := case
    when v_inv.revoked_at is not null then 'revoked'
    when v_inv.expires_at <= now() then 'expired'
    when v_inv.uses >= v_inv.max_uses then 'used_up'
    when v_company.status = 'suspended' then 'company_suspended'
    when exists (
      select 1 from public.company_members m where m.user_id = auth.uid() and m.active
    ) then 'already_member'
    else 'ok'
  end;

  return query select
    v_outcome,
    coalesce(v_company.trade_name, v_company.legal_name),
    v_inv.role,
    v_inv.monthly_budget,
    v_inv.per_order_limit,
    v_inv.expires_at;
end;
$$;

-- Joins the caller to the company. The invitation row is locked, so a link
-- with one use left admits one person even if two accept at once.
create or replace function public.accept_company_invitation(p_token text)
returns table (outcome text, company_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.company_invitations%rowtype;
  v_status text;
begin
  if v_uid is null or p_token is null then
    return query select 'not_found'::text, null::uuid;
    return;
  end if;

  select * into v_inv
  from public.company_invitations i
  where i.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
  for update;
  if not found then
    return query select 'not_found'::text, null::uuid;
    return;
  end if;

  select c.status into v_status from public.companies c where c.id = v_inv.company_id;

  if v_inv.revoked_at is not null then
    return query select 'revoked'::text, null::uuid;
    return;
  end if;
  if v_inv.expires_at <= now() then
    return query select 'expired'::text, null::uuid;
    return;
  end if;
  if v_inv.uses >= v_inv.max_uses then
    return query select 'used_up'::text, null::uuid;
    return;
  end if;
  if v_status = 'suspended' then
    return query select 'company_suspended'::text, null::uuid;
    return;
  end if;
  if exists (
    select 1 from public.company_members m where m.user_id = v_uid and m.active
  ) then
    return query select 'already_member'::text, null::uuid;
    return;
  end if;

  insert into public.company_members (
    company_id, user_id, role, monthly_budget, per_order_limit, invitation_id
  )
  values (
    v_inv.company_id, v_uid, v_inv.role, v_inv.monthly_budget,
    v_inv.per_order_limit, v_inv.id
  );

  update public.company_invitations set uses = uses + 1 where id = v_inv.id;

  return query select 'ok'::text, v_inv.company_id;
exception
  when unique_violation then
    return query select 'already_member'::text, null::uuid;
end;
$$;

-- A company admin opens a link. The token is generated by the server and
-- only its SHA-256 reaches the database (lib/companies/invitations.server.ts).
create or replace function public.create_company_invitation(
  p_company_id uuid,
  p_token_hash text,
  p_role text,
  p_monthly_budget numeric,
  p_per_order_limit numeric,
  p_max_uses integer,
  p_expires_days integer
)
returns table (outcome text, invitation_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_company_admin(p_company_id) then
    return query select 'forbidden'::text, null::uuid;
    return;
  end if;

  if exists (
    select 1 from public.companies c
    where c.id = p_company_id and c.status = 'suspended'
  ) then
    return query select 'company_suspended'::text, null::uuid;
    return;
  end if;

  insert into public.company_invitations (
    company_id, token_hash, role, monthly_budget, per_order_limit,
    max_uses, expires_at, created_by
  )
  values (
    p_company_id, p_token_hash, p_role, p_monthly_budget, p_per_order_limit,
    p_max_uses, now() + make_interval(days => p_expires_days), auth.uid()
  )
  returning id into v_id;

  return query select 'ok'::text, v_id;
exception
  when check_violation or unique_violation or numeric_value_out_of_range then
    return query select 'invalid'::text, null::uuid;
end;
$$;

create or replace function public.revoke_company_invitation(p_invitation_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
begin
  select i.company_id into v_company
  from public.company_invitations i
  where i.id = p_invitation_id;
  if not found then
    return 'not_found';
  end if;
  if not public.is_company_admin(v_company) then
    return 'forbidden';
  end if;

  update public.company_invitations
  set revoked_at = coalesce(revoked_at, now())
  where id = p_invitation_id;
  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. The team
-- ---------------------------------------------------------------------------
-- Role, budget, cap, or removal. A company never loses its last admin: the
-- company row is locked, so two admins demoting each other at the same time
-- cannot both succeed.
create or replace function public.set_company_member(
  p_member_id uuid,
  p_role text,
  p_monthly_budget numeric,
  p_per_order_limit numeric,
  p_active boolean
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.company_members%rowtype;
begin
  select * into v_member from public.company_members m where m.id = p_member_id;
  if not found then
    return 'not_found';
  end if;
  if not public.is_company_admin(v_member.company_id) then
    return 'forbidden';
  end if;

  perform 1 from public.companies c where c.id = v_member.company_id for update;
  -- Read again under the lock: a concurrent change may have landed.
  select * into v_member from public.company_members m where m.id = p_member_id;
  if not v_member.active then
    return 'inactive';
  end if;

  if v_member.role = 'admin'
     and (p_role is distinct from 'admin' or not p_active)
     and not exists (
       select 1 from public.company_members m
       where m.company_id = v_member.company_id
         and m.active
         and m.role = 'admin'
         and m.id <> v_member.id
     ) then
    return 'last_admin';
  end if;

  update public.company_members
  set role = p_role,
      monthly_budget = p_monthly_budget,
      per_order_limit = p_per_order_limit,
      active = p_active,
      left_at = case when p_active then null else now() end
  where id = p_member_id;
  return 'ok';
exception
  when check_violation or numeric_value_out_of_range then
    return 'invalid';
end;
$$;

-- Billing contact. The legal name and NIT are what the credit line was
-- approved for: only the Cerquita team changes them.
create or replace function public.update_company_billing(
  p_company_id uuid,
  p_billing_email text,
  p_billing_address text,
  p_city text,
  p_contact_name text,
  p_contact_phone text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_company_admin(p_company_id) then
    return 'forbidden';
  end if;
  update public.companies
  set billing_email = lower(p_billing_email),
      billing_address = p_billing_address,
      city = p_city,
      contact_name = p_contact_name,
      contact_phone = p_contact_phone
  where id = p_company_id;
  return 'ok';
exception
  when check_violation then
    return 'invalid';
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Reading
-- ---------------------------------------------------------------------------
-- The caller's membership and what they can charge now. The company's
-- credit line and usage are an admin's business: a member sees only what is
-- available to them (the tighter of their budget and the credit left).
create or replace function public.my_corporate_budget()
returns table (
  company_id uuid,
  company_name text,
  company_status text,
  member_id uuid,
  role text,
  monthly_budget numeric,
  per_order_limit numeric,
  spent_this_month numeric,
  credit_available numeric,
  credit_limit numeric,
  credit_used numeric,
  max_tip_pct smallint,
  overdue boolean,
  period date
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_period date := public.bogota_month_start();
begin
  if auth.uid() is null then
    return;
  end if;

  return query
  with mine as (
    select
      c.id as cid,
      coalesce(c.trade_name, c.legal_name) as cname,
      c.status as cstatus,
      c.credit_limit as climit,
      c.max_tip_pct as ctip,
      m.id as mid,
      m.role as mrole,
      m.monthly_budget as mbudget,
      m.per_order_limit as mcap,
      public.company_credit_used(c.id) as cused
    from public.company_members m
    join public.companies c on c.id = m.company_id
    where m.user_id = auth.uid() and m.active
  )
  select
    mine.cid,
    mine.cname,
    mine.cstatus,
    mine.mid,
    mine.mrole,
    mine.mbudget,
    mine.mcap,
    public.company_member_spent(mine.mid, v_period),
    greatest(0, mine.climit - mine.cused),
    case when mine.mrole = 'admin' then mine.climit end,
    case when mine.mrole = 'admin' then mine.cused end,
    mine.ctip,
    public.company_is_overdue(mine.cid),
    v_period
  from mine;
end;
$$;

-- The admin's overview of one month.
create or replace function public.company_month_summary(p_company_id uuid, p_period date)
returns table (
  orders_count bigint,
  orders_total numeric,
  members_active bigint,
  credit_limit numeric,
  credit_used numeric,
  open_balance numeric,
  overdue boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_company_admin(p_company_id) then
    return;
  end if;

  return query
  select
    month.orders_count,
    month.orders_total,
    (select count(*) from public.company_members m
      where m.company_id = p_company_id and m.active),
    c.credit_limit,
    public.company_credit_used(p_company_id),
    (select coalesce(sum(s.total), 0) from public.company_statements s
      where s.company_id = p_company_id
        and
-- codegen:begin(statement_open_summary)
s.status in ('issued', 'overdue')
-- codegen:end(statement_open_summary)
    ),
    public.company_is_overdue(p_company_id)
  from public.companies c
  cross join lateral (
    select count(*) as orders_count, coalesce(sum(o.total), 0) as orders_total
    from public.orders o
    where o.company_id = p_company_id
      and o.corporate_period = p_period
      and
-- codegen:begin(holds_credit_summary)
o.payment_method = 'corporate' and o.payment_status = 'paid' and o.status <> 'cancelled'
-- codegen:end(holds_credit_summary)
  ) month
  where c.id = p_company_id;
end;
$$;

-- Everyone who is or was on the team, for its admins.
create or replace function public.company_team(p_company_id uuid)
returns table (
  member_id uuid,
  user_id uuid,
  full_name text,
  email text,
  role text,
  monthly_budget numeric,
  per_order_limit numeric,
  spent_this_month numeric,
  active boolean,
  joined_at timestamptz,
  left_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_period date := public.bogota_month_start();
begin
  if not public.is_company_admin(p_company_id) then
    return;
  end if;

  return query
  select
    m.id,
    m.user_id,
    p.full_name,
    u.email::text,
    m.role,
    m.monthly_budget,
    m.per_order_limit,
    public.company_member_spent(m.id, v_period),
    m.active,
    m.joined_at,
    m.left_at
  from public.company_members m
  left join public.profiles p on p.id = m.user_id
  left join auth.users u on u.id = m.user_id
  where m.company_id = p_company_id
  order by m.active desc, m.role, p.full_name;
end;
$$;

-- Orders charged to the company in a month: all of them for an admin, only
-- the caller's own for a member.
create or replace function public.company_orders(p_company_id uuid, p_period date)
returns table (
  order_id uuid,
  short_code text,
  created_at timestamptz,
  store_name text,
  member_name text,
  total numeric,
  status public.order_status,
  payment_status public.payment_status,
  corporate_reference text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_admin boolean := public.is_company_admin(p_company_id);
begin
  if not public.is_company_member(p_company_id) then
    return;
  end if;

  return query
  select
    o.id,
    o.short_code,
    o.created_at,
    s.name,
    p.full_name,
    o.total,
    o.status,
    o.payment_status,
    o.corporate_reference
  from public.orders o
  join public.stores s on s.id = o.store_id
  left join public.company_members m on m.id = o.company_member_id
  left join public.profiles p on p.id = m.user_id
  where o.company_id = p_company_id
    and o.corporate_period = p_period
    and (v_admin or o.customer_id = auth.uid())
  order by o.created_at desc
  limit 500;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Grants: signed-in users only, never anon
-- ---------------------------------------------------------------------------
revoke all on function public.register_company(text, text, text, integer, text, text, text, text, text, text) from public, anon;
grant execute on function public.register_company(text, text, text, integer, text, text, text, text, text, text) to authenticated;
revoke all on function public.peek_company_invitation(text) from public, anon;
grant execute on function public.peek_company_invitation(text) to authenticated;
revoke all on function public.accept_company_invitation(text) from public, anon;
grant execute on function public.accept_company_invitation(text) to authenticated;
revoke all on function public.create_company_invitation(uuid, text, text, numeric, numeric, integer, integer) from public, anon;
grant execute on function public.create_company_invitation(uuid, text, text, numeric, numeric, integer, integer) to authenticated;
revoke all on function public.revoke_company_invitation(uuid) from public, anon;
grant execute on function public.revoke_company_invitation(uuid) to authenticated;
revoke all on function public.set_company_member(uuid, text, numeric, numeric, boolean) from public, anon;
grant execute on function public.set_company_member(uuid, text, numeric, numeric, boolean) to authenticated;
revoke all on function public.update_company_billing(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.update_company_billing(uuid, text, text, text, text, text) to authenticated;
revoke all on function public.my_corporate_budget() from public, anon;
grant execute on function public.my_corporate_budget() to authenticated;
revoke all on function public.company_month_summary(uuid, date) from public, anon;
grant execute on function public.company_month_summary(uuid, date) to authenticated;
revoke all on function public.company_team(uuid) from public, anon;
grant execute on function public.company_team(uuid) to authenticated;
revoke all on function public.company_orders(uuid, date) from public, anon;
grant execute on function public.company_orders(uuid, date) to authenticated;

reset lock_timeout;
